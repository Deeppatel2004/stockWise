const fs = require("fs");
function edit(file, steps) {
  if (!fs.existsSync(file)) { console.log(file + ": not found, skipped"); return; }
  let s = fs.readFileSync(file, "utf8");
  const crlf = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");
  for (const st of steps) {
    if (s.includes(st.mark)) { console.log(file + ": already done (" + st.name + ")"); continue; }
    if (st.re) {
      if (!st.re.test(s)) { console.log(file + ": nothing to change (" + st.name + ")"); continue; }
      s = s.replace(st.re, () => st.to);
    } else {
      if (!s.includes(st.from)) throw new Error(file + ": cannot find anchor for " + st.name);
      s = s.replace(st.from, () => st.to);
    }
    console.log(file + ": " + st.name + " ok");
  }
  fs.writeFileSync(file, crlf ? s.replace(/\n/g, "\r\n") : s);
}

// 1) remove the moving top bar
edit("index.html", [{ name: "remove ticker bar", mark: "@@never@@", re: /[ \t]*<div class="ticker">\s*<div id="tickerTrack"[^>]*><\/div>\s*<\/div>[ \t]*\n?/, to: "" }]);
edit("script.js", [{ name: "ticker guard", mark: "no ticker bar", from: "function renderTicker() {", to: 'function renderTicker() {\n  if (!document.getElementById("tickerTrack")) return; // no ticker bar' }]);

// 2) MA crossover indicator
const CROSS = `
  // ----- Moving average crossover: SMA 20 against SMA 50 -----
  const maBox = document.getElementById("maSignal");
  if (indOn.macross) {
    const a = calcSMA(currentBars, 20);
    const b = calcSMA(currentBars, 50);
    const marks = [];
    let text = "Not enough data for the 50-bar average";
    if (b.length > 1) {
      const aa = a.slice(a.length - b.length);
      [["ma20", aa, "#f7a600"], ["ma50", b, "#b44cf0"]].forEach(([id, data, color]) => {
        if (!indSeries[id]) indSeries[id] = chart.addLineSeries({ color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
        indSeries[id].setData(data);
      });
      for (let i = 1; i < b.length; i++) {
        const prev = aa[i - 1].value - b[i - 1].value;
        const now = aa[i].value - b[i].value;
        if (prev <= 0 && now > 0) marks.push({ time: b[i].time, position: "belowBar", color: "#16c784", shape: "arrowUp", text: "Buy" });
        else if (prev >= 0 && now < 0) marks.push({ time: b[i].time, position: "aboveBar", color: "#ea3943", shape: "arrowDown", text: "Sell" });
      }
      const up = aa[aa.length - 1].value > b[b.length - 1].value;
      const last = marks[marks.length - 1];
      text = "SMA 20 is " + (up ? "above" : "below") + " SMA 50 (" + (up ? "bullish" : "bearish") + ")" + (last ? " · last signal: " + last.text : " · no crossover in this range");
    }
    candleSeries.setMarkers(marks);
    lineSeries.setMarkers(marks);
    if (maBox) maBox.textContent = text;
  } else {
    ["ma20", "ma50"].forEach((id) => {
      if (indSeries[id]) { chart.removeSeries(indSeries[id]); delete indSeries[id]; }
    });
    candleSeries.setMarkers([]);
    lineSeries.setMarkers([]);
    if (maBox) maBox.textContent = "";
  }

  const box = document.getElementById("rsiBox");`;
edit("stock.js", [
  { name: "crossover logic", mark: "Moving average crossover: SMA 20", from: '\n  const box = document.getElementById("rsiBox");\n  if (box && !(chartMode === "tv"))', to: CROSS + '\n  if (box && !(chartMode === "tv"))' },
  { name: "crossover button", mark: 'data-ind="macross"', from: `'<button class="tf-btn" data-ind="rsi" style="border-bottom:3px solid #9c6bff">RSI</button>' +`,
    to: `'<button class="tf-btn" data-ind="macross" style="border-bottom:3px solid #f7a600">MA Crossover</button>' +\n      '<button class="tf-btn" data-ind="rsi" style="border-bottom:3px solid #9c6bff">RSI</button>' +\n      '<span id="maSignal" style="font-size:13px;margin-left:10px;align-self:center"></span>' +` },
]);