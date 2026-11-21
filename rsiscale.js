const fs = require("fs");
const file = "stock.js";
let s = fs.readFileSync(file, "utf8");
const crlf = s.includes("\r\n");
s = s.replace(/\r\n/g, "\n");
if (s.includes("autoscaleInfoProvider")) {
  console.log("stock.js: already patched, skipped");
} else {
  const from = 'priceLineVisible: false, lastValueVisible: true });\n  rsiSeries.createPriceLine({ price: 70';
  const to = 'priceLineVisible: false, lastValueVisible: true, autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) });\n  rsiSeries.createPriceLine({ price: 70';
  if (!s.includes(from)) throw new Error("stock.js: could not find the RSI step (apply the indicators patch first)");
  s = s.replace(from, () => to);
  fs.writeFileSync(file, crlf ? s.replace(/\n/g, "\r\n") : s);
  console.log("stock.js: patched");
}
