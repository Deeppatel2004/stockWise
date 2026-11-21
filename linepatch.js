const fs = require("fs");
const file = "stock.js";
let s = fs.readFileSync(file, "utf8");
if (s.includes("chartType")) {
  console.log("stock.js: already patched, skipped");
} else {
  const crlf = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");

  const steps = [
    [
      "let volumeSeries = null;\n",
      `let volumeSeries = null;
let lineSeries = null;
let chartType = "candles"; // "candles" or "line"
try {
  if (localStorage.getItem("chartType") === "line") chartType = "line";
} catch {
  /* storage can be blocked */
}
`,
    ],
    [
      "  chart.priceScale(\"right\").applyOptions({ scaleMargins: { top: 0.08, bottom: 0.25 } });\n\n  // Volume bars",
      `  lineSeries = chart.addAreaSeries({
    lineColor: "#2962ff",
    topColor: "rgba(41, 98, 255, 0.28)",
    bottomColor: "rgba(41, 98, 255, 0.02)",
    lineWidth: 2,
    priceLineStyle: LightweightCharts.LineStyle.Dotted,
  });
  applyChartType();
  chart.priceScale("right").applyOptions({ scaleMargins: { top: 0.08, bottom: 0.25 } });

  // Volume bars`,
    ],
    [
      "const bar = param.time ? param.seriesData.get(candleSeries) : null;",
      "const bar = param.time ? param.seriesData.get(candleSeries) || param.seriesData.get(lineSeries) : null;",
    ],
    [
      "  volumeSeries.setData(\n",
      "  lineSeries.setData(bars.map((b) => ({ time: b.time, value: b.close })));\n  volumeSeries.setData(\n",
    ],
    [
      "  candleSeries.update({ time: last.time, open: last.open, high: last.high, low: last.low, close: last.close });\n",
      "  candleSeries.update({ time: last.time, open: last.open, high: last.high, low: last.low, close: last.close });\n  lineSeries.update({ time: last.time, value: last.close });\n",
    ],
    [
      "function setupChart() {\n  setupChartModes();\n",
      `// Candles or a simple line (the original look)
function applyChartType() {
  if (!candleSeries || !lineSeries) return;
  candleSeries.applyOptions({ visible: chartType === "candles" });
  lineSeries.applyOptions({ visible: chartType === "line" });
  document.querySelectorAll("#chartTypes [data-type]").forEach((b) => b.classList.toggle("active", b.dataset.type === chartType));
}

function setupChartTypes() {
  document.getElementById("tfButtons").insertAdjacentHTML(
    "beforebegin",
    '<div class="tf-buttons chart-mode" id="chartTypes">' +
      '<button class="tf-btn" data-type="line">Line</button>' +
      '<button class="tf-btn" data-type="candles">Candles</button>' +
      "</div>"
  );
  document.getElementById("chartTypes").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-type]");
    if (!btn) return;
    chartType = btn.dataset.type;
    try {
      localStorage.setItem("chartType", chartType);
    } catch {
      /* storage can be blocked */
    }
    applyChartType();
  });
  applyChartType();
}

function setupChart() {
  setupChartModes();
  setupChartTypes();
`,
    ],
    [
      '  document.getElementById("tfButtons").style.display = tv ? "none" : "";\n',
      '  document.getElementById("tfButtons").style.display = tv ? "none" : "";\n  const types = document.getElementById("chartTypes");\n  if (types) types.style.display = tv ? "none" : "";\n',
    ],
  ];

  for (const [from, to] of steps) {
    if (!s.includes(from)) throw new Error("stock.js: could not find this text:\n" + from + "\n(apply the earlier chart steps first)");
    s = s.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? s.replace(/\n/g, "\r\n") : s);
  console.log("stock.js: patched");
}
