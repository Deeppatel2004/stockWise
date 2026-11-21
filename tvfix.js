const fs = require("fs");
const file = "stock.js";
let s = fs.readFileSync(file, "utf8");
if (s.includes("TradingView's free chart has no NSE")) {
  console.log("stock.js: already patched, skipped");
} else {
  const crlf = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");

  const steps = [
    [
      `// TradingView writes symbols like NSE:TCS, and uses _ where NSE uses & or - (M&M becomes M_M)
function tradingViewSymbol() {
  if (isIndex) return { NIFTY50: "NSE:NIFTY", SENSEX: "BSE:SENSEX", BANKNIFTY: "NSE:BANKNIFTY" }[indexId];
  return "NSE:" + stock.symbol.replace(/[&-]/g, "_");
}`,
      `// TradingView's free chart has no NSE data (it would show Apple instead). It has BSE, as end-of-day data,
// and most companies use the same name on BSE. Symbols use _ where NSE uses & or - (M&M becomes M_M).
function tradingViewSymbol() {
  if (isIndex) return { SENSEX: "BSE:SENSEX" }[indexId] || null; // NIFTY 50 and BANK NIFTY exist only on NSE
  return "BSE:" + stock.symbol.replace(/[&-]/g, "_");
}`,
    ],
    [
      "function setupChartModes() {\n",
      "function setupChartModes() {\n  if (!tradingViewSymbol()) return; // no TradingView chart for this one: only the Quick chart\n",
    ],
    [
      '<button class="tf-btn" data-mode="tv">TradingView (all tools)</button>',
      '<button class="tf-btn" data-mode="tv">TradingView (BSE, end of day)</button>',
    ],
  ];

  for (const [from, to] of steps) {
    if (!s.includes(from)) throw new Error("stock.js: could not find this text:\n" + from + "\n(apply the TradingView step first)");
    s = s.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? s.replace(/\n/g, "\r\n") : s);
  console.log("stock.js: patched");
}
