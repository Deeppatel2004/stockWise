// Run this inside the website folder (the one with script.js):  node watchlist-groups-web.js
const fs = require("fs");

function patch(file, fn, marker) {
  let s = fs.readFileSync(file, "utf8");
  if (s.includes(marker)) {
    console.log(file + ": already patched, skipped");
    return;
  }
  const crlf = s.includes("\r\n");
  s = fn(s.replace(/\r\n/g, "\n"));
  fs.writeFileSync(file, crlf ? s.replace(/\n/g, "\r\n") : s);
  console.log(file + ": patched");
}

// ---------- 1. alerts.js: also ask for the prices of stocks inside groups ----------
patch(
  "alerts.js",
  (s) => {
    const from = "  getAlerts().forEach((a) => wanted.add(a.symbol));\n";
    if (!s.includes(from)) throw new Error("alerts.js: could not find the alerts line");
    return s.replace(from, () => from + "  (userData.groups || []).forEach((g) => g.symbols.forEach((sym) => wanted.add(sym)));\n");
  },
  "userData.groups"
);

// ---------- 2. script.js: the new watchlist with groups ----------
const NEW_WATCHLIST = `// ---------- Watchlists: "My watchlist" plus your own groups ----------
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
        return "<tr><td><a class=\\"sym\\" href=\\"stock.html?symbol=" + encodeURIComponent(sym) + "\\">" + escHtml(sym) + "</a></td><td>...</td><td></td><td>" + actions + "</td></tr>";
      }
      return \`<tr>
        \${stockCell(s)}
        <td>\${fmtPrice(s.price)}</td>
        <td class="\${dirClass(s.percent)}">\${sign(s.percent)}\${s.percent.toFixed(2)}%</td>
        <td>\${actions}</td>
      </tr>\`;
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
`;

patch(
  "script.js",
  (s) => {
    const start = s.indexOf("// ---------- Watchlist ----------\nfunction renderWatchlist() {");
    const endText = 'window.addEventListener("pageshow", renderWatchlist);\n';
    const end = s.indexOf(endText);
    if (start < 0 || end < 0 || end < start) throw new Error("script.js: could not find the watchlist part");
    return s.slice(0, start) + NEW_WATCHLIST + s.slice(end + endText.length);
  },
  "wlTabs"
);