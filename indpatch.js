const fs = require("fs");
const file = "stock.js";
let s = fs.readFileSync(file, "utf8");
if (s.includes("refreshIndicators")) {
  console.log("stock.js: already patched, skipped");
} else {
  const crlf = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");

  const steps = [
    [
      "let lineSeries = null;\n",
      `let lineSeries = null;
let indOn = { sma20: false, sma50: false, ema20: false, rsi: false };
try {
  Object.assign(indOn, JSON.parse(localStorage.getItem("indicators") || "{}"));
} catch {
  /* storage can be blocked */
}
const indSeries = {};
const IND_COLORS = { sma20: "#f7a600", sma50: "#b44cf0", ema20: "#00bcd4" };
let rsiChart = null;
let rsiSeries = null;
`,
    ],
    [
      "  lineSeries.update({ time: last.time, value: last.close });\n",
      "  lineSeries.update({ time: last.time, value: last.close });\n  refreshIndicators();\n",
    ],
    [
      "  lineSeries.setData(bars.map((b) => ({ time: b.time, value: b.close })));\n",
      "  lineSeries.setData(bars.map((b) => ({ time: b.time, value: b.close })));\n  refreshIndicators();\n",
    ],
    [
      "// Candles or a simple line (the original look)\n",
      `// ---------- Indicators: moving averages on the price, RSI in a small chart below ----------
function calcSMA(bars, n) {
  const out = [];
  let sum = 0;
  bars.forEach((b, i) => {
    sum += b.close;
    if (i >= n) sum -= bars[i - n].close;
    if (i >= n - 1) out.push({ time: b.time, value: sum / n });
  });
  return out;
}

function calcEMA(bars, n) {
  const out = [];
  const k = 2 / (n + 1);
  let ema = null;
  bars.forEach((b, i) => {
    if (i < n - 1) return;
    ema = ema === null ? bars.slice(0, n).reduce((a, x) => a + x.close, 0) / n : b.close * k + ema * (1 - k);
    out.push({ time: b.time, value: ema });
  });
  return out;
}

// RSI (14). The first 14 bars have no value, so they are empty points; that keeps both charts lined up.
function calcRSI(bars, n = 14) {
  const out = bars.map((b) => ({ time: b.time }));
  if (bars.length <= n) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = bars[i].close - bars[i - 1].close;
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= n;
  loss /= n;
  const rsi = () => (loss === 0 ? 100 : 100 - 100 / (1 + gain / loss));
  out[n] = { time: bars[n].time, value: rsi() };
  for (let i = n + 1; i < bars.length; i++) {
    const d = bars[i].close - bars[i - 1].close;
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = { time: bars[i].time, value: rsi() };
  }
  return out;
}

function ensureRsiChart() {
  if (rsiChart) return;
  rsiChart = LightweightCharts.createChart(document.getElementById("rsiChart"), {
    autoSize: true,
    ...themeOptions(),
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    timeScale: { visible: false },
  });
  rsiSeries = rsiChart.addLineSeries({ color: "#9c6bff", lineWidth: 2, priceLineVisible: false, lastValueVisible: true });
  rsiSeries.createPriceLine({ price: 70, color: "#ea3943", lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true });
  rsiSeries.createPriceLine({ price: 30, color: "#16c784", lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true });
  rsiChart.priceScale("right").applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } });
  // The two charts move together
  chart.timeScale().subscribeVisibleLogicalRangeChange((r) => {
    if (r && rsiChart) rsiChart.timeScale().setVisibleLogicalRange(r);
  });
}

function refreshIndicators() {
  if (!chart || !currentBars.length) return;

  const calc = { sma20: () => calcSMA(currentBars, 20), sma50: () => calcSMA(currentBars, 50), ema20: () => calcEMA(currentBars, 20) };
  for (const id of Object.keys(calc)) {
    if (indOn[id]) {
      if (!indSeries[id]) {
        indSeries[id] = chart.addLineSeries({ color: IND_COLORS[id], lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      }
      indSeries[id].setData(calc[id]());
    } else if (indSeries[id]) {
      chart.removeSeries(indSeries[id]);
      delete indSeries[id];
    }
  }

  const box = document.getElementById("rsiBox");
  if (box && !(chartMode === "tv")) box.style.display = indOn.rsi ? "block" : "none";
  if (indOn.rsi) {
    ensureRsiChart();
    rsiSeries.setData(calcRSI(currentBars));
    rsiChart.timeScale().setVisibleLogicalRange(chart.timeScale().getVisibleLogicalRange() || { from: 0, to: currentBars.length });
  }
}

function setupIndicators() {
  const tf = document.getElementById("tfButtons");
  tf.insertAdjacentHTML(
    "beforebegin",
    '<div class="tf-buttons chart-mode" id="chartTools">' +
      '<button class="tf-btn" data-ind="sma20" style="border-bottom:3px solid ' + IND_COLORS.sma20 + '">SMA 20</button>' +
      '<button class="tf-btn" data-ind="sma50" style="border-bottom:3px solid ' + IND_COLORS.sma50 + '">SMA 50</button>' +
      '<button class="tf-btn" data-ind="ema20" style="border-bottom:3px solid ' + IND_COLORS.ema20 + '">EMA 20</button>' +
      '<button class="tf-btn" data-ind="rsi" style="border-bottom:3px solid #9c6bff">RSI</button>' +
      "</div>"
  );
  document.querySelector(".chart-wrap").insertAdjacentHTML(
    "afterend",
    '<div id="rsiBox" style="display:none;height:130px;margin-top:6px"><div id="rsiChart" style="height:100%"></div></div>'
  );
  const mark = () =>
    document.querySelectorAll("#chartTools [data-ind]").forEach((b) => b.classList.toggle("active", Boolean(indOn[b.dataset.ind])));
  document.getElementById("chartTools").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-ind]");
    if (!btn) return;
    indOn[btn.dataset.ind] = !indOn[btn.dataset.ind];
    try {
      localStorage.setItem("indicators", JSON.stringify(indOn));
    } catch {
      /* storage can be blocked */
    }
    mark();
    refreshIndicators();
  });
  mark();
}

// Candles or a simple line (the original look)
`,
    ],
    [
      "function setupChart() {\n  setupChartModes();\n  setupChartTypes();\n",
      "function setupChart() {\n  setupChartModes();\n  setupChartTypes();\n  setupIndicators();\n",
    ],
    [
      '  if (types) types.style.display = tv ? "none" : "";\n',
      '  if (types) types.style.display = tv ? "none" : "";\n  const tools = document.getElementById("chartTools");\n  if (tools) tools.style.display = tv ? "none" : "";\n  const rsiBox = document.getElementById("rsiBox");\n  if (rsiBox) rsiBox.style.display = tv || !indOn.rsi ? "none" : "block";\n',
    ],
    [
      "  if (chart) chart.applyOptions(themeOptions());\n",
      "  if (chart) chart.applyOptions(themeOptions());\n  if (rsiChart) rsiChart.applyOptions(themeOptions());\n",
    ],
  ];

  for (const [from, to] of steps) {
    if (!s.includes(from)) throw new Error("stock.js: could not find this text:\n" + from + "\n(apply the earlier chart steps first)");
    s = s.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? s.replace(/\n/g, "\r\n") : s);
  console.log("stock.js: patched");
}
