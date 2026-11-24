// Run this inside the website folder (the one with settings.html):  node compare-web.js
const fs = require("fs");

// ---------- 1. The compare script ----------
fs.writeFileSync(
  "compare.js",
  `// Compare stocks: how much each one moved over the same period, starting from 0%
const escHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const COLORS = ["#2962ff", "#f7a600", "#16c784", "#ea3943"];
const MAX_STOCKS = 4;
let range = "6M";
let symbols = [];
try {
  const fromUrl = new URLSearchParams(location.search).get("s");
  if (fromUrl) symbols = fromUrl.toUpperCase().split(",").filter((s) => /^[A-Z0-9&-]{1,20}$/.test(s)).slice(0, MAX_STOCKS);
  if (localStorage.getItem("cmpRange")) range = localStorage.getItem("cmpRange");
} catch {
  /* storage can be blocked */
}
if (!symbols.length) symbols = ["TCS", "INFY"];

const chipsBox = document.getElementById("cmpChips");
const input = document.getElementById("cmpInput");
const note = document.getElementById("cmpNote");
let chart = null;
let series = [];
let loadToken = 0;

const isDark = () => document.documentElement.getAttribute("data-theme") !== "light";
function themeOptions() {
  const dark = isDark();
  return {
    layout: { background: { type: "solid", color: dark ? "#131722" : "#ffffff" }, textColor: dark ? "#d1d4dc" : "#222" },
    grid: { vertLines: { color: dark ? "#1f2433" : "#eee" }, horzLines: { color: dark ? "#1f2433" : "#eee" } },
  };
}

function ensureChart() {
  if (chart) return;
  chart = LightweightCharts.createChart(document.getElementById("cmpChart"), {
    autoSize: true,
    ...themeOptions(),
    timeScale: { borderVisible: false },
    rightPriceScale: { borderVisible: false },
    localization: { priceFormatter: (v) => (v >= 0 ? "+" : "") + v.toFixed(1) + "%" },
  });
  new MutationObserver(() => chart.applyOptions(themeOptions())).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

function drawChips() {
  chipsBox.innerHTML = symbols
    .map(
      (s, i) =>
        '<button class="tf-btn active" data-remove="' + escHtml(s) + '" title="Click to remove" style="border-bottom:3px solid ' + COLORS[i] + '">' + escHtml(s) + " &#10005;</button>"
    )
    .join("");
  input.disabled = symbols.length >= MAX_STOCKS;
  document.getElementById("cmpAdd").disabled = symbols.length >= MAX_STOCKS;
  try {
    history.replaceState(null, "", "compare.html?s=" + encodeURIComponent(symbols.join(",")));
  } catch {
    /* ignore */
  }
}

// Dates as YYYY-MM-DD in Indian time, one point per day
const dayOf = (t) => new Date(t).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
function toSeries(points) {
  const byDay = new Map();
  points.forEach((p) => {
    if (p.c != null) byDay.set(dayOf(p.t), p);
  });
  return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

async function load() {
  const token = ++loadToken;
  drawChips();
  document.querySelectorAll("#cmpRanges [data-range]").forEach((b) => b.classList.toggle("active", b.dataset.range === range));
  note.textContent = symbols.length < 2 ? "Add at least one more stock to compare." : "";

  const results = await Promise.all(
    symbols.map((sym) =>
      api("/stocks/" + encodeURIComponent(sym) + "/history?range=" + range)
        .then((d) => ({ sym, rows: toSeries(d.points || []) }))
        .catch((err) => ({ sym, error: err.message }))
    )
  );
  if (token !== loadToken) return; // something newer was chosen

  ensureChart();
  series.forEach((s) => chart.removeSeries(s));
  series = [];

  const stats = [];
  const failed = [];
  results.forEach((r, i) => {
    if (r.error || r.rows.length < 2) {
      failed.push(r.sym);
      return;
    }
    const base = r.rows[0][1].c;
    const line = chart.addLineSeries({ color: COLORS[i], lineWidth: 2, priceLineVisible: false, lastValueVisible: true, title: r.sym });
    line.setData(r.rows.map(([day, p]) => ({ time: day, value: (p.c / base - 1) * 100 })));
    if (!series.length) line.createPriceLine({ price: 0, color: "#8d99ae", lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: false });
    series.push(line);

    const last = r.rows[r.rows.length - 1][1].c;
    stats.push({
      sym: r.sym,
      color: COLORS[i],
      start: base,
      last,
      change: (last / base - 1) * 100,
      high: Math.max(...r.rows.map(([, p]) => p.h ?? p.c)),
      low: Math.min(...r.rows.map(([, p]) => p.l ?? p.c)),
    });
  });
  chart.timeScale().fitContent();

  if (failed.length) note.textContent = "Could not load: " + failed.join(", ") + ". Check the symbol or try again in a moment.";

  document.getElementById("cmpBody").innerHTML = stats
    .map(
      (s) => \`<tr>
        <td><b style="border-left:4px solid \${s.color};padding-left:6px"><a class="sym" href="stock.html?symbol=\${encodeURIComponent(s.sym)}">\${escHtml(s.sym)}</a></b></td>
        <td>\${fmtPrice(s.start)}</td><td>\${fmtPrice(s.last)}</td>
        <td class="\${dirClass(s.change)}"><b>\${sign(s.change)}\${s.change.toFixed(2)}%</b></td>
        <td>\${fmtPrice(s.high)}</td><td>\${fmtPrice(s.low)}</td>
      </tr>\`
    )
    .join("");

  const winner = document.getElementById("cmpWinner");
  if (stats.length >= 2) {
    const sorted = [...stats].sort((a, b) => b.change - a.change);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    winner.innerHTML =
      "Over " + range + ", <b>" + escHtml(best.sym) + "</b> did best (" + sign(best.change) + best.change.toFixed(2) + "%) and <b>" + escHtml(worst.sym) +
      "</b> did weakest (" + sign(worst.change) + worst.change.toFixed(2) + "%): a gap of " + (best.change - worst.change).toFixed(2) + " points.";
  } else {
    winner.textContent = "";
  }
}

function addSymbol() {
  const sym = input.value.trim().toUpperCase().split(/\\s+/)[0];
  if (!/^[A-Z0-9&-]{1,20}$/.test(sym)) {
    note.textContent = "Type a stock symbol, for example TCS or M&M.";
    return;
  }
  if (symbols.includes(sym)) {
    note.textContent = sym + " is already in the comparison.";
    return;
  }
  if (symbols.length >= MAX_STOCKS) return;
  symbols.push(sym);
  input.value = "";
  load();
}

document.getElementById("cmpAdd").addEventListener("click", addSymbol);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addSymbol();
});

chipsBox.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-remove]");
  if (!btn) return;
  symbols = symbols.filter((s) => s !== btn.dataset.remove);
  load();
});

document.getElementById("cmpRanges").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-range]");
  if (!btn) return;
  range = btn.dataset.range;
  try {
    localStorage.setItem("cmpRange", range);
  } catch {
    /* storage can be blocked */
  }
  load();
});

// Suggestions while typing
let suggestTimer = null;
input.addEventListener("input", () => {
  clearTimeout(suggestTimer);
  const q = input.value.trim();
  if (q.length < 2) return;
  suggestTimer = setTimeout(async () => {
    try {
      const found = await api("/stocks/search?q=" + encodeURIComponent(q));
      document.getElementById("cmpList").innerHTML = found
        .map((s) => '<option value="' + escHtml(s.symbol) + '">' + escHtml(s.name) + "</option>")
        .join("");
    } catch {
      /* no suggestions */
    }
  }, 300);
});

load();
`
);
console.log("compare.js: created");

// ---------- 2. The compare page: your Settings page, with a new middle part ----------
let page = fs.readFileSync("settings.html", "utf8");
if (!/<main[\s\S]*<\/main>/.test(page) || !page.includes('<script src="settings.js"></script>')) {
  throw new Error("settings.html: could not find its main part or settings.js");
}
const MAIN = `<main class="container">
    <h2>Compare stocks</h2>
    <p class="settings-intro">Add up to 4 stocks. The chart shows how much each one moved over the period, all starting from 0%.</p>
    <div class="card">
      <div id="cmpChips" class="tf-buttons chart-mode"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">
        <input id="cmpInput" list="cmpList" type="text" placeholder="Add a stock (e.g. TCS)" autocomplete="off" style="padding:6px 10px;border-radius:8px;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit" />
        <datalist id="cmpList"></datalist>
        <button class="btn" id="cmpAdd">Add</button>
      </div>
      <div id="cmpRanges" class="tf-buttons">
        <button class="tf-btn" data-range="1M">1M</button>
        <button class="tf-btn" data-range="6M">6M</button>
        <button class="tf-btn" data-range="1Y">1Y</button>
        <button class="tf-btn" data-range="5Y">5Y</button>
      </div>
      <div id="cmpChart" style="height:380px;margin-top:8px"></div>
      <p id="cmpNote" class="empty"></p>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>Stock</th><th>Start</th><th>Latest</th><th>Change</th><th>High</th><th>Low</th></tr></thead>
        <tbody id="cmpBody"></tbody>
      </table>
      <p id="cmpWinner"></p>
    </div>
  </main>`;
page = page
  .replace(/<title>[\s\S]*?<\/title>/, "<title>StockWise - Compare stocks</title>")
  .replace(/<main[\s\S]*<\/main>/, () => MAIN)
  .replace(
    '<script src="settings.js"></script>',
    '<script src="https://unpkg.com/lightweight-charts@4.2.3/dist/lightweight-charts.standalone.production.js"></script>\n  <script src="compare.js"></script>'
  );
fs.writeFileSync("compare.html", page);
console.log("compare.html: created");

// ---------- 3. A "Compare" link next to Portfolio, on every page ----------
const portfolioLink = '<a class="nav-link" href="portfolio.html">Portfolio</a>';
const compareLink = '\n      <a class="nav-link" href="compare.html">Compare</a>';
for (const name of fs.readdirSync(".")) {
  if (!/\.html$/i.test(name) || name === "compare.html") continue;
  const h = fs.readFileSync(name, "utf8");
  if (!h.includes(portfolioLink)) continue;
  if (h.includes('href="compare.html"')) {
    console.log(name + ": already done, skipped");
    continue;
  }
  fs.writeFileSync(name, h.replace(portfolioLink, () => portfolioLink + compareLink));
  console.log(name + ": link added");
}