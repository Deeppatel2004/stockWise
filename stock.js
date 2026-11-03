const params = new URLSearchParams(location.search);
const symbol = (params.get("symbol") || "").toUpperCase();
const stock = stocks.find((s) => s.symbol === symbol);
const view = document.getElementById("stockView");

// ---------- Mock history generator ----------
const TIMEFRAMES = {
  "1D": { points: 76,  stepDays: 0,  vol: 0.004 },
  "1W": { points: 7,   stepDays: 1,  vol: 0.012 },
  "1M": { points: 30,  stepDays: 1,  vol: 0.012 },
  "6M": { points: 180, stepDays: 1,  vol: 0.015 },
  "1Y": { points: 365, stepDays: 1,  vol: 0.015 },
  "5Y": { points: 60,  stepDays: 30, vol: 0.06 },
};

function generateHistory(s, tf) {
  const { points, stepDays, vol } = TIMEFRAMES[tf];
  const rng = mulberry32(hashStr(s.symbol + tf));

  // Walk backwards from the starting price
  const data = new Array(points);
  data[points - 1] = s.price;
  for (let i = points - 2; i >= 0; i--) {
    data[i] = data[i + 1] * (1 + (rng() - 0.5) * vol * 2);
  }

  const labels = [];
  for (let i = 0; i < points; i++) {
    if (tf === "1D") {
      const mins = 9 * 60 + 15 + i * 5; // 9:15 AM, every 5 minutes
      labels.push(String(Math.floor(mins / 60)).padStart(2, "0") + ":" + String(mins % 60).padStart(2, "0"));
    } else {
      const d = new Date();
      d.setDate(d.getDate() - (points - 1 - i) * stepDays);
      labels.push(
        tf === "5Y"
          ? d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
          : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
      );
    }
  }
  return { labels, data };
}

// ---------- Page ----------
function renderPage() {
  const rng = mulberry32(hashStr(stock.symbol));
  const prevClose = stock.prevClose;
  const change = stock.price - prevClose;
  const open = prevClose * (1 + (rng() - 0.5) * 0.01);
  const high = Math.max(open, stock.price) * (1 + rng() * 0.01);
  const low = Math.min(open, stock.price) * (1 - rng() * 0.01);
  const high52 = stock.price * (1.1 + rng() * 0.25);
  const low52 = stock.price * (0.6 + rng() * 0.25);
  const info = details[stock.symbol];

  const stats = [
    ["Open", fmtPrice(open)],
    ["Prev. Close", fmtPrice(prevClose)],
    ["Day High", fmtPrice(high)],
    ["Day Low", fmtPrice(low)],
    ["52W High", fmtPrice(high52)],
    ["52W Low", fmtPrice(low52)],
    ["Volume", fmtVolume(stock.volume)],
    ["Market Cap", info.mcap],
    ["P/E Ratio", info.pe],
  ];

  view.innerHTML = `
    <div class="stock-head">
      <div>
        <h1>${stock.name} <small>${stock.symbol}</small></h1>
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
      <div class="chart-wrap"><canvas id="priceChart"></canvas></div>
    </div>

    <div class="stats-grid">
      ${stats
        .map(([label, value]) => `<div class="stat"><span>${label}</span><b>${value}</b></div>`)
        .join("")}
    </div>

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
      <h2>About ${stock.name}</h2>
      <p>${info.about}</p>
    </div>
  `;

  setupWatchlistButton();
  setupChart();
  setupAlerts();
}

// ---------- Live price (updates every tick) ----------
function updateLivePrice() {
  const change = stock.price - stock.prevClose;
  document.getElementById("priceBig").textContent = "₹" + fmtPrice(stock.price);
  const el = document.getElementById("priceChange");
  el.className = dirClass(change);
  el.textContent = `${sign(change)}${change.toFixed(2)} (${sign(stock.percent)}${stock.percent.toFixed(2)}%)`;
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
            <button class="link-btn" data-remove-alert="${a.id}">Remove</button>
          </li>`
        )
        .join("")
    : `<li class="empty">No alerts for ${stock.symbol} yet.</li>`;
}

function setupAlerts() {
  document.getElementById("alertForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const target = parseFloat(document.getElementById("alertPrice").value);
    if (!(target > 0)) return;

    addAlert(stock.symbol, document.getElementById("alertCond").value, target);
    e.target.reset();
    checkAlerts(); // fire right away if the target is already met
    renderAlertList();
  });

  document.getElementById("alertList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove-alert]");
    if (!btn) return;
    removeAlert(Number(btn.dataset.removeAlert));
    renderAlertList();
  });

  renderAlertList();
}

// ---------- Chart ----------
let chart = null;
let currentTF = "1M";

function drawChart(tf) {
  currentTF = tf;
  const { labels, data } = generateHistory(stock, tf);
  const color = data[data.length - 1] >= data[0] ? "#16c784" : "#ea3943";
  const css = getComputedStyle(document.documentElement);
  const muted = css.getPropertyValue("--muted").trim();
  const border = css.getPropertyValue("--border").trim();

  if (chart) chart.destroy();

  chart = new Chart(document.getElementById("priceChart"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        data,
        borderColor: color,
        backgroundColor: color + "22",
        fill: true,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.25,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => "₹" + fmtPrice(c.parsed.y) } },
      },
      scales: {
        x: { ticks: { color: muted, maxTicksLimit: 8 }, grid: { display: false } },
        y: { ticks: { color: muted }, grid: { color: border } },
      },
    },
  });

  document.querySelectorAll(".tf-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tf === tf);
  });
}

function setupChart() {
  document.getElementById("tfButtons").addEventListener("click", (e) => {
    const btn = e.target.closest(".tf-btn");
    if (btn) drawChart(btn.dataset.tf);
  });
  drawChart(currentTF);
}

window.addEventListener("themechange", () => {
  if (chart) drawChart(currentTF);
});

// ---------- Start ----------
if (!stock) {
  view.innerHTML = `
    <div class="card">
      <h2>Stock not found</h2>
      <p><a class="back-link" href="index.html">← Back to dashboard</a></p>
    </div>`;
} else {
  document.title = `${stock.symbol} - StockWise`;
  renderPage();
  window.addEventListener("pricetick", () => {
    updateLivePrice();
    renderAlertList(); // shows the "Triggered" badge as soon as an alert fires
  });
}