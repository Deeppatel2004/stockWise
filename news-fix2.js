// Stops news.js from clashing with stock.js. Run this in the main folder (D:\stockWise):  node news-fix2.js
const fs = require("fs");
let s = fs.readFileSync("news.js", "utf8");
if (s.startsWith("(function () {")) {
  console.log("news.js: already done, skipped");
} else {
  const crlf = s.includes("\r\n");
  s = "(function () {\n" + s.replace(/\r\n/g, "\n").replace(/\n+$/, "\n") + "})();\n";
  fs.writeFileSync("news.js", crlf ? s.replace(/\n/g, "\r\n") : s);
  console.log("news.js: fixed");
}