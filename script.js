// Makes text safe to put inside HTML (stock names can contain & and similar characters)
const escHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ---------- Ticker bar ----------
function renderTicker() {
  const items = [
    ...indices.map((i) => ({ label: i.name, price: i.value, percent: i.percent })),
    ...stocks.filter((s) => !s.extra).map((s) => ({ label: s.symbol, price: s.price, percent: s.percent })),
  ];

  const html = items
    .map(
      (i) => `<span class="ticker-item">
        <b>${i.label}</b> ${fmtPrice(i.price)}
        <span class="${dirClass(i.percent)}">${sign(i.percent)}${i.percent.toFixed(2)}%</span>
      </span>`
    )
    .join("");

  // Repeat twice so the scrolling loop looks seamless
  document.getElementById("tickerTrack").innerHTML = html + html;
}

// ---------- Index cards (click one to open its chart) ----------
const INDEX_IDS = { "NIFTY 50": "NIFTY50", SENSEX: "SENSEX", "BANK NIFTY": "BANKNIFTY" };
function renderIndices() {
  document.getElementById("indicesGrid").innerHTML = indices
    .map(
      (i) => `<a class="index-card index-link" href="stock.html?index=${INDEX_IDS[i.name] || ""}">
        <div class="name">${i.name}</div>
        <div class="value">${fmtPrice(i.value)}</div>
        <div class="${dirClass(i.change)}">
          ${sign(i.change)}${i.change.toFixed(2)} (${sign(i.percent)}${i.percent.toFixed(2)}%)
        </div>
      </a>`
    )
    .join("");
}

// ---------- Tables ----------
function stockCell(s) {
  return `<td>
    <a class="sym" href="stock.html?symbol=${encodeURIComponent(s.symbol)}">${escHtml(s.symbol)}</a>
    <span class="co">${escHtml(s.name)}</span>
  </td>`;
}

// About 50 big companies from the server (gainers, losers and most active use them when they have loaded)
let screenerPool = null;
async function loadScreener() {
  try {
    const list = await api("/stocks/screener");
    if (Array.isArray(list) && list.length > 10) {
      screenerPool = list;
      renderTables();
    }
  } catch (err) {
    /* the built-in stocks are used instead */
  }
}

function renderTables() {
  // Gainers, losers and most active use only the built-in stocks, not ones you searched for
  const pool = screenerPool || stocks.filter((s) => !s.extra);
  const gainers = pool.filter((s) => s.percent > 0).sort((a, b) => b.percent - a.percent).slice(0, 5);
  const losers = pool.filter((s) => s.percent < 0).sort((a, b) => a.percent - b.percent).slice(0, 5);
  const active = [...pool].sort((a, b) => b.volume - a.volume).slice(0, 5);

  document.getElementById("gainersBody").innerHTML = gainers
    .map((s) => `<tr>${stockCell(s)}<td>${fmtPrice(s.price)}</td><td class="up">+${s.percent.toFixed(2)}%</td></tr>`)
    .join("");

  document.getElementById("losersBody").innerHTML = losers
    .map((s) => `<tr>${stockCell(s)}<td>${fmtPrice(s.price)}</td><td class="down">${s.percent.toFixed(2)}%</td></tr>`)
    .join("");

  document.getElementById("activeBody").innerHTML = active
    .map((s) => `<tr>${stockCell(s)}<td>${fmtPrice(s.price)}</td><td>${fmtVolume(s.volume)}</td></tr>`)
    .join("");
  renderSectors();
}

// ---------- Sectors: the average move of each group of companies ----------
const SECTORS = {
  "IT": ["TCS", "INFY", "WIPRO", "HCLTECH", "TECHM"],
  "Banks": ["HDFCBANK", "ICICIBANK", "SBIN", "KOTAKBANK", "AXISBANK", "INDUSINDBK"],
  "Financials": ["BAJFINANCE", "BAJAJFINSV", "SBILIFE", "HDFCLIFE", "SHRIRAMFIN"],
  "Auto": ["MARUTI", "M&M", "BAJAJ-AUTO", "TATAMOTORS", "EICHERMOT", "HEROMOTOCO"],
  "Energy & Power": ["RELIANCE", "ONGC", "NTPC", "POWERGRID", "COALINDIA"],
  "Metals": ["TATASTEEL", "JSWSTEEL", "HINDALCO"],
  "Pharma & Health": ["SUNPHARMA", "CIPLA", "DRREDDY", "APOLLOHOSP", "DIVISLAB"],
  "FMCG": ["ITC", "HINDUNILVR", "NESTLEIND", "BRITANNIA", "TATACONSUM"],
  "Infra & Industrials": ["LT", "ADANIENT", "ADANIPORTS", "ULTRACEMCO", "GRASIM", "BEL"],
  "Consumer & Telecom": ["BHARTIARTL", "TITAN", "ASIANPAINT", "TRENT"],
};

function renderSectors() {
  if (!screenerPool) return; // needs the bigger list of companies
  let box = document.getElementById("sectorBox");
  if (!box) {
    document.getElementById("indicesGrid").insertAdjacentHTML("afterend", '<div id="sectorBox" class="card"></div>');
    box = document.getElementById("sectorBox");
  }

  const rows = Object.entries(SECTORS)
    .map(([name, syms]) => {
      const list = screenerPool.filter((q) => syms.includes(q.symbol));
      if (!list.length) return null;
      const avg = list.reduce((sum, q) => sum + q.percent, 0) / list.length;
      const top = [...list].sort((a, b) => b.percent - a.percent)[0];
      return { name, avg, count: list.length, top };
    })
    .filter(Boolean)
    .sort((a, b) => b.avg - a.avg);
  if (!rows.length) return;

  const max = Math.max(...rows.map((r) => Math.abs(r.avg)), 0.01);
  box.innerHTML =
    '<b>Sectors today</b> <small>(average change of the big companies in each)</small>' +
    rows
      .map(
        (r) => `<div style="display:flex;align-items:center;gap:10px;margin:8px 0;font-size:14px">
          <span style="width:140px;flex:none">${escHtml(r.name)}</span>
          <span style="flex:1;height:10px;background:rgba(128,128,128,0.15);border-radius:5px;overflow:hidden">
            <span style="display:block;height:100%;width:${(Math.abs(r.avg) / max) * 100}%;background:${r.avg >= 0 ? "#16c784" : "#ea3943"}"></span>
          </span>
          <b class="${dirClass(r.avg)}" style="width:64px;text-align:right;flex:none">${sign(r.avg)}${r.avg.toFixed(2)}%</b>
          <small style="width:120px;flex:none;white-space:nowrap"><a class="sym" href="stock.html?symbol=${encodeURIComponent(r.top.symbol)}">${escHtml(r.top.symbol)}</a> ${sign(r.top.percent)}${r.top.percent.toFixed(1)}%</small>
        </div>`
      )
      .join("");
}

// ---------- Market status (IST: Mon-Fri, 9:15 AM - 3:30 PM) ----------
function updateMarketStatus() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type) => parts.find((p) => p.type === type).value;
  const day = get("weekday");
  const minutes = (parseInt(get("hour"), 10) % 24) * 60 + parseInt(get("minute"), 10);

  const isWeekday = !["Sat", "Sun"].includes(day);
  const isOpen = isWeekday && minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30;

  const el = document.getElementById("marketStatus");
  el.textContent = isOpen ? "● Market Open" : "● Market Closed";
  el.className = "market-status " + (isOpen ? "open" : "closed");
}

// ---------- Search any NSE stock ----------
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");

let searchTimer = null;
let searchToken = 0;

function showResults(items) {
  searchResults.innerHTML = items.length
    ? items
        .map((s) => {
          const known = stocks.find((x) => x.symbol === s.symbol);
          const pct = known ? `<span class="${dirClass(known.percent)}">${sign(known.percent)}${known.percent.toFixed(2)}%</span>` : "";
          return `<li data-symbol="${escHtml(s.symbol)}">
            <span><b>${escHtml(s.symbol)}</b> <small>${escHtml(s.name)}</small></span>${pct}
          </li>`;
        })
        .join("")
    : `<li>No results found</li>`;
  searchResults.hidden = false;
}

searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim();
  clearTimeout(searchTimer);

  if (!q) {
    searchResults.hidden = true;
    return;
  }

  // 1) instant results from the stocks already loaded
  const lq = q.toLowerCase();
  const local = stocks
    .filter((s) => s.symbol.toLowerCase().includes(lq) || s.name.toLowerCase().includes(lq))
    .slice(0, 6)
    .map((s) => ({ symbol: s.symbol, name: s.name }));
  showResults(local);

  // 2) then every NSE stock from the server (after a short pause while typing)
  searchTimer = setTimeout(async () => {
    const token = ++searchToken;
    try {
      const remote = await api("/stocks/search?q=" + encodeURIComponent(q));
      if (token !== searchToken || searchInput.value.trim() !== q) return; // typed something newer
      const seen = new Set(local.map((s) => s.symbol));
      showResults([...local, ...remote.filter((r) => !seen.has(r.symbol))].slice(0, 8));
    } catch (err) {
      /* keep the local results */
    }
  }, 300);
});

searchResults.addEventListener("click", (e) => {
  const li = e.target.closest("li[data-symbol]");
  if (!li) return;
  location.href = "stock.html?symbol=" + encodeURIComponent(li.dataset.symbol);
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-box")) searchResults.hidden = true;
});

// ---------- Watchlist ----------
function renderWatchlist() {
  const list = getWatchlist()
    .map((sym) => stocks.find((s) => s.symbol === sym))
    .filter(Boolean);

  document.getElementById("watchlistTable").hidden = list.length === 0;
  document.getElementById("watchlistEmpty").hidden = getWatchlist().length > 0;

  document.getElementById("watchlistBody").innerHTML = list
    .map(
      (s) => `<tr>
        ${stockCell(s)}
        <td>${fmtPrice(s.price)}</td>
        <td class="${dirClass(s.percent)}">${sign(s.percent)}${s.percent.toFixed(2)}%</td>
        <td><button class="link-btn" data-remove="${escHtml(s.symbol)}">Remove</button></td>
      </tr>`
    )
    .join("");
}

document.getElementById("watchlistBody").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-remove]");
  if (!btn) return;
  toggleWatchlist(btn.dataset.remove);
  renderWatchlist();
});

// Refresh when coming back from the stock page with the browser Back button
window.addEventListener("pageshow", renderWatchlist);

// ---------- Start ----------
renderTicker();
renderIndices();
renderTables();
renderWatchlist();
updateMarketStatus();
loadScreener();
setInterval(() => {
  if (!document.hidden) loadScreener();
}, 30 * 1000);
setInterval(updateMarketStatus, 60 * 1000); // re-check every minute

// ---------- Live updates ----------
window.addEventListener("pricetick", () => {
  renderIndices();
  renderTables();
  renderWatchlist();
});
window.addEventListener("userdataloaded", renderWatchlist);