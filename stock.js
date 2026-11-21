// Makes text safe to put inside HTML (stock names can contain & and similar characters)
const escHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const params = new URLSearchParams(location.search);
const symbol = (params.get("symbol") || "").toUpperCase();
const indexId = (params.get("index") || "").toUpperCase(); // stock.html?index=NIFTY50 shows an index
const INDEX_NAMES = { NIFTY50: "NIFTY 50", SENSEX: "SENSEX", BANKNIFTY: "BANK NIFTY" };
const isIndex = Boolean(indexId);
let stock = isIndex ? null : stocks.find((s) => s.symbol === symbol); // built-in stocks are found right away
const view = document.getElementById("stockView");

// ---------- Simulated history (used only when live history is unavailable) ----------
const TIMEFRAMES = {
  "1D": { points: 76,  stepDays: 0,  vol: 0.004 },
  "1W": { points: 7,   stepDays: 1,  vol: 0.012 },
  "1M": { points: 30,  stepDays: 1,  vol: 0.012 },
  "6M": { points: 180, stepDays: 1,  vol: 0.015 },
  "1Y": { points: 365, stepDays: 1,  vol: 0.015 },
  "5Y": { points: 60,  stepDays: 30, vol: 0.06 },
};

const IST_OFFSET = 19800; // IST is 5h30m ahead of UTC (in seconds)

// Simulated candles: [{ t, o, h, l, c, v }]
function simulatePoints(s, tf) {
  const { points, stepDays, vol } = TIMEFRAMES[tf];
  const rng = mulberry32(hashStr(s.symbol + tf));

  const closes = new Array(points);
  closes[points - 1] = s.price;
  for (let i = points - 2; i >= 0; i--) {
    closes[i] = closes[i + 1] * (1 + (rng() - 0.5) * vol * 2);
  }

  // Today at 00:00 IST, in milliseconds
  const ist = new Date(Date.now() + IST_OFFSET * 1000);
  const dayStart = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET * 1000;
  const open915 = dayStart + (9 * 60 + 15) * 60 * 1000;

  return closes.map((close, i) => {
    const open = i ? closes[i - 1] : close * (1 + (rng() - 0.5) * vol);
    const t = tf === "1D" ? open915 + i * 5 * 60 * 1000 : open915 - (points - 1 - i) * stepDays * 24 * 60 * 60 * 1000;
    return {
      t: new Date(t).toISOString(),
      o: open,
      h: Math.max(open, close) * (1 + rng() * vol * 0.5),
      l: Math.min(open, close) * (1 - rng() * vol * 0.5),
      c: close,
      v: Math.round((s.volume / points) * (0.5 + rng())),
    };
  });
}

// ---------- Stats ----------
const num = (n) => (n == null ? "—" : fmtPrice(n));
const fmtMcap = (n) => (n == null ? "—" : "₹" + (n / 1e12).toFixed(2) + " L Cr");

// Simulated stats for the built-in stocks, shown instantly while the real ones load.
// Other stocks show dashes until the real numbers arrive.
function placeholderStats() {
  const info = details[stock.symbol];
  if (!info) {
    return { open: null, prevClose: stock.prevClose, high: null, low: null, high52: null, low52: null, volume: stock.volume, mcap: "—", pe: "—" };
  }
  const rng = mulberry32(hashStr(stock.symbol));
  const prevClose = stock.prevClose;
  const open = prevClose * (1 + (rng() - 0.5) * 0.01);
  const high = Math.max(open, stock.price) * (1 + rng() * 0.01);
  const low = Math.min(open, stock.price) * (1 - rng() * 0.01);
  return {
    open, prevClose, high, low,
    high52: stock.price * (1.1 + rng() * 0.25),
    low52: stock.price * (0.6 + rng() * 0.25),
    volume: stock.volume,
    mcap: info.mcap,
    pe: info.pe,
  };
}

function statsHtml(s) {
  const items = [
    ["Open", num(s.open)],
    ["Prev. Close", num(s.prevClose)],
    ["Day High", num(s.high)],
    ["Day Low", num(s.low)],
    ["52W High", num(s.high52)],
    ["52W Low", num(s.low52)],
    ["Volume", s.volume == null ? "—" : fmtVolume(s.volume)],
    ["Market Cap", s.mcap],
    ["P/E Ratio", s.pe],
  ];
  return items.map(([label, value]) => `<div class="stat"><span>${label}</span><b>${value}</b></div>`).join("");
}

// Replace the placeholder stats (and the About text) with real ones from the server
async function loadRealDetails() {
  try {
    const d = await api("/stocks/" + encodeURIComponent(stock.symbol));
    document.getElementById("statsGrid").innerHTML = statsHtml({
      open: d.open,
      prevClose: d.prevClose,
      high: d.high,
      low: d.low,
      high52: d.high52,
      low52: d.low52,
      volume: d.volume,
      mcap: fmtMcap(d.marketCap),
      pe: d.pe == null ? "—" : d.pe.toFixed(1),
    });
    if (d.about) {
      document.getElementById("aboutText").textContent = d.about;
    } else if (!details[stock.symbol]) {
      document.getElementById("aboutText").textContent = "No company profile is available for this stock.";
    }
  } catch (err) {
    console.warn("Showing placeholder stats:", err.message);
    if (!details[stock.symbol]) {
      document.getElementById("aboutText").textContent = "No company profile is available right now.";
    }
  }
}

// ---------- Page ----------
function renderPage() {
  const change = stock.price - stock.prevClose;
  const info = details[stock.symbol];
  const about = info ? info.about : "Loading the company profile…";

  view.innerHTML = `
    <div class="stock-head">
      <div>
        <h1>${escHtml(stock.name)} <small>${escHtml(stock.symbol)}</small></h1>
        <div class="price-row">
          <span class="price-big" id="priceBig">₹${fmtPrice(stock.price)}</span>
          <span id="priceChange" class="${dirClass(change)}">
            ${sign(change)}${change.toFixed(2)} (${sign(stock.percent)}${stock.percent.toFixed(2)}%)
          </span>
        </div>
      </div>
      <button id="watchBtn" class="btn"></button>
    </div>

    <div class="card">
      <div class="tf-buttons" id="tfButtons">
        ${Object.keys(TIMEFRAMES)
          .map((tf) => `<button class="tf-btn" data-tf="${tf}">${tf}</button>`)
          .join("")}
      </div>
      <p id="chartNote" class="chart-note"></p>
      <div class="chart-wrap">
        <div id="priceChart"></div>
        <div id="chartLegend" class="chart-legend"></div>
      </div>
    </div>

    <div class="stats-grid" id="statsGrid">${statsHtml(placeholderStats())}</div>

    <div class="card alert-card">
      <h2>🔔 Price Alerts</h2>
      <form id="alertForm" class="inline-form">
        <select id="alertCond" aria-label="Alert condition">
          <option value="above">Price goes above</option>
          <option value="below">Price goes below</option>
        </select>
        <input type="number" id="alertPrice" step="0.01" min="0.01" placeholder="Target price (₹)" required />
        <button class="btn" type="submit">Set Alert</button>
      </form>
      <ul id="alertList" class="alert-list"></ul>
    </div>

    <div class="card about">
      <h2>About ${escHtml(stock.name)}</h2>
      <p id="aboutText">${escHtml(about)}</p>
    </div>
  `;

  setupWatchlistButton();
  setupChart();
  setupAlerts();
  loadRealDetails();
}

// ---------- Live price (updates every refresh) ----------
function updateLivePrice() {
  const change = stock.price - stock.prevClose;
  document.getElementById("priceBig").textContent = (isIndex ? "" : "₹") + fmtPrice(stock.price);
  const el = document.getElementById("priceChange");
  el.className = dirClass(change);
  el.textContent = `${sign(change)}${change.toFixed(2)} (${sign(stock.percent)}${stock.percent.toFixed(2)}%)`;
  updateLiveCandle();
}

// ---------- Watchlist button ----------
function setupWatchlistButton() {
  const btn = document.getElementById("watchBtn");

  function refresh() {
    const added = getWatchlist().includes(stock.symbol);
    btn.textContent = added ? "★ In Watchlist" : "☆ Add to Watchlist";
    btn.classList.toggle("active", added);
  }

  btn.addEventListener("click", () => {
    toggleWatchlist(stock.symbol);
    refresh();
  });

  window.addEventListener("userdataloaded", refresh);
  refresh();
}

// ---------- Price alerts ----------
function renderAlertList() {
  const list = getAlerts().filter((a) => a.symbol === stock.symbol);
  document.getElementById("alertList").innerHTML = list.length
    ? list
        .map(
          (a) => `<li>
            <span>
              ${a.condition === "above" ? "Above" : "Below"} ₹${fmtPrice(a.target)}
              ${a.triggered ? '<span class="badge-done">✓ Triggered</span>' : ""}
            </span>
            <button class="link-btn" data-remove-alert="${a._id}">Remove</button>
          </li>`
        )
        .join("")
    : `<li class="empty">No alerts for ${escHtml(stock.symbol)} yet.</li>`;
}

function setupAlerts() {
  document.getElementById("alertForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const target = parseFloat(document.getElementById("alertPrice").value);
    if (!(target > 0)) return;

    try {
      await addAlert(stock.symbol, document.getElementById("alertCond").value, target);
      form.reset();
      await refreshLive(); // the server checks the new alert right away
      renderAlertList();
    } catch (err) {
      showToast("Could not set alert", err.message);
    }
  });

  document.getElementById("alertList").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-remove-alert]");
    if (!btn) return;
    try {
      await removeAlert(btn.dataset.removeAlert);
      renderAlertList();
    } catch (err) {
      showToast("Could not remove alert", err.message);
    }
  });

  renderAlertList();
}

// ---------- Chart (candlesticks and volume, like TradingView) ----------
const UP = "#16c784";
const DOWN = "#ea3943";
const INTRADAY = { "1D": true, "1W": true }; // these show clock times, the others show dates

let chart = null;
let candleSeries = null;
let volumeSeries = null;
let currentBars = [];
let currentTF = "1M";
let drawToken = 0;       // lets a newer click cancel an older, slower request
let chartIsLive = false; // true when the candles are real (not simulated)
let crosshairOn = false;
const liveSeries = {};   // real history already downloaded, per timeframe

// Time for the chart. Clock times are shifted so that they show in IST; days use the IST date.
function toChartTime(iso, tf) {
  const ms = new Date(iso).getTime();
  if (INTRADAY[tf]) return Math.floor(ms / 1000) + IST_OFFSET;
  const d = new Date(ms + IST_OFFSET * 1000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

const keyOf = (time) => (typeof time === "number" ? time : time.year * 10000 + time.month * 100 + time.day);

// Candles must be in time order with no duplicates
function buildBars(points, tf) {
  const map = new Map();
  for (const p of points) {
    const time = toChartTime(p.t, tf);
    map.set(keyOf(time), {
      time,
      open: p.o ?? p.c,
      high: p.h ?? p.c,
      low: p.l ?? p.c,
      close: p.c,
      volume: p.v || 0,
    });
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
}

// Real history from the server, or simulated candles if that fails
async function getSeries(tf) {
  if (liveSeries[tf]) return liveSeries[tf];
  try {
    const path = isIndex ? `/stocks/indices/${indexId}/history` : `/stocks/${encodeURIComponent(stock.symbol)}/history`;
    const res = await api(`${path}?range=${tf}`);
    liveSeries[tf] = { bars: buildBars(res.points, tf), live: true };
    return liveSeries[tf];
  } catch (err) {
    console.warn("Showing simulated chart:", err.message);
    return { bars: buildBars(simulatePoints(stock, tf), tf), live: false };
  }
}

function chartColors() {
  const css = getComputedStyle(document.documentElement);
  return {
    text: css.getPropertyValue("--muted").trim() || "#888888",
    grid: css.getPropertyValue("--border").trim() || "#2a2e39",
  };
}

function themeOptions() {
  const c = chartColors();
  return {
    layout: { background: { type: "solid", color: "transparent" }, textColor: c.text },
    grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
    rightPriceScale: { borderColor: c.grid },
    timeScale: { borderColor: c.grid },
  };
}

// The line at the top of the chart: Open, High, Low, Close and the change
function showLegend(bar) {
  const legend = document.getElementById("chartLegend");
  if (!legend || !bar) return;

  const i = currentBars.findIndex((b) => keyOf(b.time) === keyOf(bar.time));
  const prevClose = i > 0 ? currentBars[i - 1].close : bar.open;
  const change = bar.close - prevClose;
  const pct = prevClose ? (change / prevClose) * 100 : 0;
  const cls = dirClass(change);

  legend.innerHTML =
    `<span>O <b>${fmtPrice(bar.open)}</b></span>` +
    `<span>H <b>${fmtPrice(bar.high)}</b></span>` +
    `<span>L <b>${fmtPrice(bar.low)}</b></span>` +
    `<span>C <b>${fmtPrice(bar.close)}</b></span>` +
    `<span class="${cls}"><b>${sign(change)}${change.toFixed(2)} (${sign(pct)}${pct.toFixed(2)}%)</b></span>` +
    (bar.volume ? `<span>Vol <b>${fmtVolume(bar.volume)}</b></span>` : "");
}

function ensureChart() {
  if (chart) return;

  chart = LightweightCharts.createChart(document.getElementById("priceChart"), {
    autoSize: true, // follows the size of its box
    ...themeOptions(),
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    localization: { priceFormatter: (p) => fmtPrice(p) },
  });

  candleSeries = chart.addCandlestickSeries({
    upColor: UP,
    downColor: DOWN,
    borderUpColor: UP,
    borderDownColor: DOWN,
    wickUpColor: UP,
    wickDownColor: DOWN,
    priceLineStyle: LightweightCharts.LineStyle.Dotted, // dotted line across to the latest price
  });
  chart.priceScale("right").applyOptions({ scaleMargins: { top: 0.08, bottom: 0.25 } });

  // Volume bars along the bottom
  volumeSeries = chart.addHistogramSeries({
    priceFormat: { type: "volume" },
    priceScaleId: "volume",
    lastValueVisible: false,
    priceLineVisible: false,
  });
  chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

  chart.subscribeCrosshairMove((param) => {
    const bar = param.time ? param.seriesData.get(candleSeries) : null;
    crosshairOn = Boolean(bar);
    const shown = bar ? currentBars.find((b) => keyOf(b.time) === keyOf(param.time)) : currentBars[currentBars.length - 1];
    showLegend(shown);
  });
}

async function drawChart(tf) {
  currentTF = tf;
  const token = ++drawToken;

  document.querySelectorAll("#tfButtons .tf-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tf === tf);
  });
  const note = document.getElementById("chartNote");
  note.textContent = "Loading chart…";

  const { bars, live } = await getSeries(tf);
  if (token !== drawToken) return; // a newer request replaced this one

  note.textContent = live ? "" : "Simulated chart (live history is unavailable right now)";

  ensureChart();
  chart.applyOptions({ timeScale: { timeVisible: Boolean(INTRADAY[tf]), secondsVisible: false } });

  currentBars = bars;
  chartIsLive = live;
  // Indices have no volume, so the price area can use the whole height
  chart.priceScale("right").applyOptions({ scaleMargins: { top: 0.08, bottom: bars.some((b) => b.volume > 0) ? 0.25 : 0.08 } });

  candleSeries.setData(bars.map((b) => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close })));
  volumeSeries.setData(
    bars.map((b) => ({ time: b.time, value: b.volume, color: b.close >= b.open ? UP + "66" : DOWN + "66" }))
  );
  chart.timeScale().fitContent();
  showLegend(bars[bars.length - 1]);
}

// Every price refresh moves the last candle, so the chart is live
function updateLiveCandle() {
  if (!candleSeries || !chartIsLive || !currentBars.length) return;

  const last = currentBars[currentBars.length - 1];
  const price = stock.price;
  if (!(price > 0) || price === last.close) return;

  last.close = price;
  last.high = Math.max(last.high, price);
  last.low = Math.min(last.low, price);
  candleSeries.update({ time: last.time, open: last.open, high: last.high, low: last.low, close: last.close });
  if (!crosshairOn) showLegend(last);
}

// ---------- Full TradingView chart (TradingView's free widget: indicators, drawing tools, all intervals) ----------
let chartMode = "quick";
try {
  if (localStorage.getItem("chartMode") === "tv") chartMode = "tv";
} catch {
  /* storage can be blocked */
}

// TradingView's free chart has no NSE data (it would show Apple instead). It has BSE, as end-of-day data,
// and most companies use the same name on BSE. Symbols use _ where NSE uses & or - (M&M becomes M_M).
function tradingViewSymbol() {
  if (isIndex) return { SENSEX: "BSE:SENSEX" }[indexId] || null; // NIFTY 50 and BANK NIFTY exist only on NSE
  return "BSE:" + stock.symbol.replace(/[&-]/g, "_");
}

function showTradingView() {
  const box = document.getElementById("tvBox");
  if (!box) return;
  box.innerHTML = "";

  const holder = document.createElement("div");
  holder.className = "tradingview-widget-container";
  holder.style.cssText = "height:100%;width:100%";
  const inner = document.createElement("div");
  inner.className = "tradingview-widget-container__widget";
  inner.style.cssText = "height:100%;width:100%";
  holder.appendChild(inner);

  const script = document.createElement("script");
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
  script.async = true;
  script.innerHTML = JSON.stringify({
    autosize: true,
    symbol: tradingViewSymbol(),
    interval: "D",
    timezone: "Asia/Kolkata",
    theme: document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark",
    style: "1", // candlesticks
    locale: "en",
    allow_symbol_change: true,
    hide_side_toolbar: false, // the drawing tools on the left
    withdateranges: true,
    save_image: true,
    support_host: "https://www.tradingview.com",
  });
  holder.appendChild(script);
  box.appendChild(holder);
}

function setChartMode(mode) {
  chartMode = mode === "tv" ? "tv" : "quick";
  try {
    localStorage.setItem("chartMode", chartMode);
  } catch {
    /* storage can be blocked */
  }

  const card = document.getElementById("tfButtons").closest(".card");
  card.querySelectorAll("#chartModes [data-mode]").forEach((b) => b.classList.toggle("active", b.dataset.mode === chartMode));

  const tv = chartMode === "tv";
  document.getElementById("tfButtons").style.display = tv ? "none" : "";
  document.getElementById("chartNote").style.display = tv ? "none" : "";
  card.querySelector(".chart-wrap").style.display = tv ? "none" : "";
  document.getElementById("tvBox").style.display = tv ? "block" : "none";

  if (tv) showTradingView();
  else if (chart) chart.timeScale().fitContent();
}

function setupChartModes() {
  if (!tradingViewSymbol()) return; // no TradingView chart for this one: only the Quick chart
  const card = document.getElementById("tfButtons").closest(".card");
  card.querySelector(".chart-wrap").insertAdjacentHTML("afterend", '<div id="tvBox" class="tv-box"></div>');
  card.insertAdjacentHTML(
    "afterbegin",
    '<div class="tf-buttons chart-mode" id="chartModes">' +
      '<button class="tf-btn" data-mode="quick">Quick chart</button>' +
      '<button class="tf-btn" data-mode="tv">TradingView (BSE, end of day)</button>' +
      "</div>"
  );
  document.getElementById("chartModes").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-mode]");
    if (btn) setChartMode(btn.dataset.mode);
  });
  setChartMode(chartMode);
}

function setupChart() {
  setupChartModes();
  document.getElementById("tfButtons").addEventListener("click", (e) => {
    const btn = e.target.closest(".tf-btn");
    if (btn) drawChart(btn.dataset.tf);
  });
  drawChart(currentTF);
}

window.addEventListener("themechange", () => {
  if (chart) chart.applyOptions(themeOptions());
  if (chartMode === "tv") showTradingView(); // the TradingView chart takes its colours when it is created
});

// ---------- Start ----------
function showNotFound(message) {
  view.innerHTML = `
    <div class="card">
      <h2>Stock not found</h2>
      <p class="empty">${escHtml(message)}</p>
      <p><a class="back-link" href="index.html">← Back to dashboard</a></p>
    </div>`;
}

// A stock outside the built-in list: look it up on the server and add it to the page's data
async function loadOtherStock() {
  const d = await api("/stocks/" + encodeURIComponent(symbol));
  const s = {
    symbol,
    name: d.name,
    price: d.price,
    prevClose: d.prevClose ?? d.price,
    percent: d.percent ?? 0,
    volume: d.volume ?? 0,
    extra: true,
  };
  stocks.push(s);
  return s;
}

// ---------- Index page (NIFTY 50, SENSEX, BANK NIFTY): the price and the same candlestick chart ----------
function indexAsStock() {
  const i = indices.find((x) => x.name === INDEX_NAMES[indexId]);
  return i ? { symbol: indexId, name: i.name, price: i.value, prevClose: i.value - i.change, percent: i.percent, volume: 0 } : null;
}

function renderIndexPage() {
  const change = stock.price - stock.prevClose;

  view.innerHTML = `
    <div class="stock-head">
      <div>
        <h1>${escHtml(stock.name)} <small>INDEX</small></h1>
        <div class="price-row">
          <span class="price-big" id="priceBig">${fmtPrice(stock.price)}</span>
          <span id="priceChange" class="${dirClass(change)}">
            ${sign(change)}${change.toFixed(2)} (${sign(stock.percent)}${stock.percent.toFixed(2)}%)
          </span>
        </div>
      </div>
      <a class="back-link" href="index.html">← Dashboard</a>
    </div>

    <div class="card">
      <div class="tf-buttons" id="tfButtons">
        ${Object.keys(TIMEFRAMES)
          .map((tf) => `<button class="tf-btn" data-tf="${tf}">${tf}</button>`)
          .join("")}
      </div>
      <p id="chartNote" class="chart-note"></p>
      <div class="chart-wrap">
        <div id="priceChart"></div>
        <div id="chartLegend" class="chart-legend"></div>
      </div>
    </div>
  `;

  setupChart();
}

function startIndexPage() {
  stock = indexAsStock();
  if (!stock) return showNotFound("That index does not exist.");

  document.title = `${stock.name} - StockWise`;
  renderIndexPage();
  window.addEventListener("pricetick", () => {
    Object.assign(stock, indexAsStock());
    updateLivePrice();
  });
}

async function start() {
  if (isIndex) return startIndexPage();
  if (!stock) {
    if (!/^[A-Z0-9&-]{1,20}$/.test(symbol)) return showNotFound("That is not a valid NSE symbol.");
    view.innerHTML = `<div class="card"><p class="empty">Loading ${escHtml(symbol)}…</p></div>`;
    try {
      stock = await loadOtherStock();
    } catch (err) {
      return showNotFound(err.message);
    }
  }

  document.title = `${stock.symbol} - StockWise`;
  renderPage();
  window.addEventListener("userdataloaded", renderAlertList);
  window.addEventListener("pricetick", () => {
    updateLivePrice();
    renderAlertList();
  });
}

start();