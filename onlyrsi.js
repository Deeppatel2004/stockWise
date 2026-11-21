const fs = require("fs");
const file = "stock.js";
let s = fs.readFileSync(file, "utf8");
const crlf = s.includes("\r\n");
s = s.replace(/\r\n/g, "\n");
if (!s.includes('data-ind="sma20"')) {
  console.log("stock.js: already patched, skipped");
} else {
  const lines = [
    `      '<button class="tf-btn" data-ind="sma20" style="border-bottom:3px solid ' + IND_COLORS.sma20 + '">SMA 20</button>' +\n`,
    `      '<button class="tf-btn" data-ind="sma50" style="border-bottom:3px solid ' + IND_COLORS.sma50 + '">SMA 50</button>' +\n`,
    `      '<button class="tf-btn" data-ind="ema20" style="border-bottom:3px solid ' + IND_COLORS.ema20 + '">EMA 20</button>' +\n`,
  ];
  for (const l of lines) {
    if (!s.includes(l)) throw new Error("stock.js: could not find this line:\n" + l);
    s = s.replace(l, () => "");
  }
  const calcLine = "  const calc = { sma20: () => calcSMA(currentBars, 20), sma50: () => calcSMA(currentBars, 50), ema20: () => calcEMA(currentBars, 20) };\n";
  if (!s.includes(calcLine)) throw new Error("stock.js: could not find the moving average line");
  s = s.replace(calcLine, () => "  const calc = {}; // moving averages are switched off: only RSI is used\n");
  fs.writeFileSync(file, crlf ? s.replace(/\n/g, "\r\n") : s);
  console.log("stock.js: patched");
}
