const fs = require("fs");
const file = "stock.js";
let s = fs.readFileSync(file, "utf8");
const crlf = s.includes("\r\n");
s = s.replace(/\r\n/g, "\n");
if (s.includes("fmtBarDate")) { console.log("stock.js: dates already added"); process.exit(0); }

const FN = `// ---------- Dates on the chart (legend, hover label and the bottom axis) ----------
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtBarDate(time) {
  if (typeof time === "number") {
    const d = new Date(time * 1000); // clock times were already shifted to IST, so read them as UTC
    let h = d.getUTCHours();
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear() + ", " + h + ":" + String(d.getUTCMinutes()).padStart(2, "0") + " " + ap;
  }
  return time.day + " " + MONTHS[time.month - 1] + " " + time.year;
}
function tickLabel(time, type) {
  const d = typeof time === "number" ? new Date(time * 1000) : new Date(Date.UTC(time.year, time.month - 1, time.day));
  if (type === 0) return String(d.getUTCFullYear());
  if (type === 1) return MONTHS[d.getUTCMonth()];
  if (type === 2) return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()];
  return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
}

`;
const a1 = "// The line at the top of the chart: Open, High, Low, Close and the change\nfunction showLegend(bar) {";
if (!s.includes(a1)) throw new Error("stock.js: showLegend anchor not found");
s = s.replace(a1, () => FN + a1);

const a2 = "  legend.innerHTML =\n    `<span>O <b>";
if (!s.includes(a2)) throw new Error("stock.js: legend anchor not found");
s = s.replace(a2, () => "  legend.innerHTML =\n    `<span><b>${fmtBarDate(bar.time)}</b></span>` +\n    `<span>O <b>");

const a3 = "    localization: { priceFormatter: (p) => fmtPrice(p) },\n  });\n";
if (!s.includes(a3)) throw new Error("stock.js: chart options anchor not found");
s = s.replace(a3, () => a3 + "  chart.applyOptions({\n    localization: { timeFormatter: fmtBarDate },\n    timeScale: { tickMarkFormatter: tickLabel },\n  });\n");

fs.writeFileSync(file, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log("stock.js: dates added");