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

// ---------- Watchlists: "My watchlist" plus your own groups ----------
userData.groups = userData.groups || [];
let wlActive = "default";
try {
  wlActive = localStorage.getItem("wlTab") || "default";
} catch {
  /* storage can be blocked */
}
let wlKey = ""; // the tabs are only redrawn when something changed, so typing is never interrupted

const wlHeading = document.querySelector(".watchlist h2");
if (wlHeading) wlHeading.textContent = "Watchlists";
document.getElementById("watchlistTable").insertAdjacentHTML(
  "beforebegin",
  '<div class="tf-buttons chart-mode" id="wlTabs"></div><div id="wlTools" style="margin:8px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center"></div>'
);
const wlEmptyText = document.getElementById("watchlistEmpty").textContent;

const activeGroup = () => userData.groups.find((g) => g._id === wlActive) || null;
function activeSymbols() {
  const g = activeGroup();
  return g ? g.symbols : getWatchlist();
}

function drawWatchlistFrame() {
  const g = activeGroup();
  if (!g) wlActive = "default";

  document.getElementById("wlTabs").innerHTML =
    '<button class="tf-btn' + (wlActive === "default" ? " active" : "") + '" data-tab="default">My watchlist (' + getWatchlist().length + ")</button>" +
    userData.groups
      .map((x) => '<button class="tf-btn' + (x._id === wlActive ? " active" : "") + '" data-tab="' + escHtml(x._id) + '">' + escHtml(x.name) + " (" + x.symbols.length + ")</button>")
      .join("") +
    '<button class="tf-btn" data-newgroup>+ New group</button>';

  document.getElementById("wlTools").innerHTML =
    '<input id="wlAdd" type="text" placeholder="Add a stock (e.g. TCS)" autocomplete="off" style="padding:6px 10px;border-radius:8px;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit">' +
    '<button class="btn" id="wlAddBtn">Add</button>' +
    (g ? '<button class="link-btn" data-rename>Rename group</button><button class="link-btn" data-delgroup>Delete group</button>' : "");

  document.getElementById("watchlistEmpty").textContent = g ? "Nothing in this group yet. Type a stock above and press Add." : wlEmptyText;
}

function renderWatchlist() {
  const key = [wlActive, getWatchlist().length, userData.groups.map((g) => g._id + g.name + g.symbols.length).join(",")].join("|");
  if (key !== wlKey) {
    wlKey = key;
    drawWatchlistFrame();
  }

  // Do not redraw the rows while a "Move to" list is open
  if (document.activeElement && document.activeElement.matches("#watchlistBody select")) return;

  const symbols = activeSymbols();
  document.getElementById("watchlistTable").hidden = symbols.length === 0;
  document.getElementById("watchlistEmpty").hidden = symbols.length > 0;

  const targets =
    '<option value="default">My watchlist</option>' + userData.groups.map((g) => '<option value="' + escHtml(g._id) + '">' + escHtml(g.name) + "</option>").join("");

  document.getElementById("watchlistBody").innerHTML = symbols
    .map((sym) => {
      const s = stocks.find((x) => x.symbol === sym);
      const actions =
        '<select data-move="' + escHtml(sym) + '" aria-label="Move ' + escHtml(sym) + '" style="max-width:110px"><option value="">Move to...</option>' +
        targets.replace('<option value="' + escHtml(wlActive) + '">', '<option value="' + escHtml(wlActive) + '" hidden>') +
        '</select> <button class="link-btn" data-remove="' + escHtml(sym) + '">Remove</button>';
      if (!s || s.price == null) {
        return "<tr><td><a class=\"sym\" href=\"stock.html?symbol=" + encodeURIComponent(sym) + "\">" + escHtml(sym) + "</a></td><td>...</td><td></td><td>" + actions + "</td></tr>";
      }
      return `<tr>
        ${stockCell(s)}
        <td>${fmtPrice(s.price)}</td>
        <td class="${dirClass(s.percent)}">${sign(s.percent)}${s.percent.toFixed(2)}%</td>
        <td>${actions}</td>
      </tr>`;
    })
    .join("");
}

async function loadGroups() {
  try {
    userData.groups = await api("/watchlist/groups");
    wlKey = "";
    renderWatchlist();
  } catch (err) {
    /* groups stay empty; "My watchlist" still works */
  }
}

async function groupCall(path, method, body) {
  try {
    userData.groups = await api(path, method, body);
    wlKey = "";
    renderWatchlist();
    return true;
  } catch (err) {
    showToast("Could not save", err.message);
    return false;
  }
}

// Add a stock to a list ("default" or a group id)
async function addTo(target, sym) {
  if (target === "default") {
    if (!getWatchlist().includes(sym)) toggleWatchlist(sym);
    wlKey = "";
    renderWatchlist();
    return true;
  }
  return groupCall("/watchlist/groups/" + target + "/symbols", "POST", { symbol: sym });
}

async function removeFrom(target, sym) {
  if (target === "default") {
    if (getWatchlist().includes(sym)) toggleWatchlist(sym);
    wlKey = "";
    renderWatchlist();
    return true;
  }
  return groupCall("/watchlist/groups/" + target + "/symbols/" + encodeURIComponent(sym), "DELETE");
}

document.querySelector(".watchlist").addEventListener("click", async (e) => {
  const tab = e.target.closest("[data-tab]");
  if (tab) {
    wlActive = tab.dataset.tab;
    try {
      localStorage.setItem("wlTab", wlActive);
    } catch {
      /* storage can be blocked */
    }
    wlKey = "";
    renderWatchlist();
    return;
  }

  if (e.target.closest("[data-newgroup]")) {
    const name = (prompt("Name of the new group (for example Banks):") || "").trim();
    if (!name) return;
    if (await groupCall("/watchlist/groups", "POST", { name })) {
      wlActive = userData.groups[userData.groups.length - 1]._id;
      try {
        localStorage.setItem("wlTab", wlActive);
      } catch {
        /* storage can be blocked */
      }
      wlKey = "";
      renderWatchlist();
    }
    return;
  }

  const g = activeGroup();
  if (g && e.target.closest("[data-rename]")) {
    const name = (prompt("New name for this group:", g.name) || "").trim();
    if (name && name !== g.name) groupCall("/watchlist/groups/" + g._id, "PUT", { name });
    return;
  }
  if (g && e.target.closest("[data-delgroup]")) {
    if (confirm('Delete the group "' + g.name + '"? The stocks stay available on their own pages.')) {
      if (await groupCall("/watchlist/groups/" + g._id, "DELETE")) {
        wlActive = "default";
        wlKey = "";
        renderWatchlist();
      }
    }
    return;
  }

  if (e.target.closest("#wlAddBtn")) {
    const input = document.getElementById("wlAdd");
    const sym = input.value.trim().toUpperCase();
    if (!/^[A-Z0-9&-]{1,20}$/.test(sym)) {
      showToast("Not a valid symbol", "Type the stock symbol, for example TCS or M&M");
      return;
    }
    if (await addTo(wlActive, sym)) {
      const again = document.getElementById("wlAdd");
      if (again) again.focus();
    }
    return;
  }

  const rm = e.target.closest("[data-remove]");
  if (rm) removeFrom(wlActive, rm.dataset.remove);
});

document.querySelector(".watchlist").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "wlAdd") document.getElementById("wlAddBtn").click();
});

document.querySelector(".watchlist").addEventListener("change", async (e) => {
  const sel = e.target.closest("[data-move]");
  if (!sel || !sel.value) return;
  const sym = sel.dataset.move;
  const from = wlActive;
  const to = sel.value;
  sel.blur();
  if (to === from) return;
  if (await addTo(to, sym)) await removeFrom(from, sym);
});

// Refresh when coming back from the stock page with the browser Back button
window.addEventListener("pageshow", renderWatchlist);
window.addEventListener("userdataloaded", loadGroups);

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