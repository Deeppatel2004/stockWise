// ---------- Ticker bar ----------
function renderTicker() {
  const items = [
    ...indices.map((i) => ({ label: i.name, price: i.value, percent: i.percent })),
    ...stocks.map((s) => ({ label: s.symbol, price: s.price, percent: s.percent })),
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

// ---------- Index cards ----------
function renderIndices() {
  document.getElementById("indicesGrid").innerHTML = indices
    .map(
      (i) => `<div class="index-card">
        <div class="name">${i.name}</div>
        <div class="value">${fmtPrice(i.value)}</div>
        <div class="${dirClass(i.change)}">
          ${sign(i.change)}${i.change.toFixed(2)} (${sign(i.percent)}${i.percent.toFixed(2)}%)
        </div>
      </div>`
    )
    .join("");
}

// ---------- Tables ----------
function stockCell(s) {
  return `<td>
    <a class="sym" href="stock.html?symbol=${s.symbol}">${s.symbol}</a>
    <span class="co">${s.name}</span>
  </td>`;
}

function renderTables() {
  const gainers = [...stocks].filter((s) => s.percent > 0).sort((a, b) => b.percent - a.percent).slice(0, 5);
  const losers = [...stocks].filter((s) => s.percent < 0).sort((a, b) => a.percent - b.percent).slice(0, 5);
  const active = [...stocks].sort((a, b) => b.volume - a.volume).slice(0, 5);

  document.getElementById("gainersBody").innerHTML = gainers
    .map((s) => `<tr>${stockCell(s)}<td>${fmtPrice(s.price)}</td><td class="up">+${s.percent.toFixed(2)}%</td></tr>`)
    .join("");

  document.getElementById("losersBody").innerHTML = losers
    .map((s) => `<tr>${stockCell(s)}<td>${fmtPrice(s.price)}</td><td class="down">${s.percent.toFixed(2)}%</td></tr>`)
    .join("");

  document.getElementById("activeBody").innerHTML = active
    .map((s) => `<tr>${stockCell(s)}<td>${fmtPrice(s.price)}</td><td>${fmtVolume(s.volume)}</td></tr>`)
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

// ---------- Search with autocomplete ----------
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");

searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim().toLowerCase();

  if (!q) {
    searchResults.hidden = true;
    return;
  }

  const matches = stocks
    .filter((s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
    .slice(0, 6);

  searchResults.innerHTML = matches.length
    ? matches
        .map(
          (s) => `<li data-symbol="${s.symbol}">
            <span><b>${s.symbol}</b> <small>${s.name}</small></span>
            <span class="${dirClass(s.percent)}">${sign(s.percent)}${s.percent.toFixed(2)}%</span>
          </li>`
        )
        .join("")
    : `<li>No results found</li>`;

  searchResults.hidden = false;
});

searchResults.addEventListener("click", (e) => {
  const li = e.target.closest("li[data-symbol]");
  if (!li) return;
  location.href = "stock.html?symbol=" + li.dataset.symbol;
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
  document.getElementById("watchlistEmpty").hidden = list.length > 0;

  document.getElementById("watchlistBody").innerHTML = list
    .map(
      (s) => `<tr>
        ${stockCell(s)}
        <td>${fmtPrice(s.price)}</td>
        <td class="${dirClass(s.percent)}">${sign(s.percent)}${s.percent.toFixed(2)}%</td>
        <td><button class="link-btn" data-remove="${s.symbol}">Remove</button></td>
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
setInterval(updateMarketStatus, 60 * 1000); // re-check every minute
// ---------- Live updates ----------
window.addEventListener("pricetick", () => {
  renderTables();
  renderWatchlist();
});