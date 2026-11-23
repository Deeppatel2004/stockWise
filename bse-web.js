const fs = require("fs");
const file = "stock.js";
let s = fs.readFileSync(file, "utf8");
if (s.includes("-BO$")) {
  console.log("stock.js: already patched, skipped");
} else {
  const crlf = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");
  const from = 'return "BSE:" + stock.symbol.replace(/[&-]/g, "_");';
  const to = 'return "BSE:" + stock.symbol.replace(/-BO$/, "").replace(/[&-]/g, "_"); // ABC-BO is a BSE stock';
  if (!s.includes(from)) throw new Error("stock.js: could not find the TradingView symbol line (apply the TradingView step first)");
  s = s.replace(from, () => to);
  fs.writeFileSync(file, crlf ? s.replace(/\n/g, "\r\n") : s);
  console.log("stock.js: patched");
}
