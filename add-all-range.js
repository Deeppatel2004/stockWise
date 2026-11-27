// Adds an "All" time frame (the whole history of the stock, one candle per month, like Yahoo's "All")
const fs = require("fs");
function edit(file, from, to, mark) {
  if (!fs.existsSync(file)) throw new Error(file + " not found. Run this inside D:\\stockWise");
  let s = fs.readFileSync(file, "utf8");
  const crlf = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");
  if (s.includes(mark)) { console.log(file + ": already done"); return; }
  if (!s.includes(from)) throw new Error(file + ": anchor not found: " + from.slice(0, 40));
  s = s.replace(from, () => to);
  fs.writeFileSync(file, crlf ? s.replace(/\n/g, "\r\n") : s);
  console.log(file + ": All range added");
}
edit("server/services/marketData.js",
  '  "5Y": { days: 1826, interval: "1wk", ttl: 60 * 60 * 1000 },\n',
  '  "5Y": { days: 1826, interval: "1wk", ttl: 60 * 60 * 1000 },\n  "All": { days: 12000, interval: "1mo", ttl: 6 * 60 * 60 * 1000 }, // everything since the stock was listed\n',
  '"All": {');
edit("stock.js",
  '  "5Y": { points: 60,  stepDays: 30, vol: 0.06 },\n',
  '  "5Y": { points: 60,  stepDays: 30, vol: 0.06 },\n  "All": { points: 240, stepDays: 30, vol: 0.08 },\n',
  '"All": {');