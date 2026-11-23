const escHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const symbolInput = document.getElementById("hSymbol");
const symbolList = document.getElementById("symbolOptions");

const money = (n) => "₹" + fmtPrice(n);
const signedMoney = (n) => (n >= 0 ? "+" : "-") + "₹" + fmtPrice(Math.abs(n));

// ---------- Suggestions while typing a symbol or company name ----------
let suggestTimer = null;
symbolInput.addEventListener("input", () => {
  clearTimeout(suggestTimer);
  const q = symbolInput.value.trim();
  if (q.length < 2) return;

  suggestTimer = setTimeout(async () => {
    try {
      const results = await api("/stocks/search?q=" + encodeURIComponent(q));
      symbolList.innerHTML = results
        .map((r) => `<option value="${escHtml(r.symbol)}">${escHtml(r.name)}</option>`)
        .join("");
    } catch (err) {
      /* suggestions are optional */
    }
  }, 300);
});

// Makes sure the stock exists and its price is loaded (it can be any NSE stock)
async function ensureStock(sym) {
  if (stocks.find((s) => s.symbol === sym)) return;
  const d = await api("/stocks/" + encodeURIComponent(sym)); // 404 = no such stock
  stocks.push({
    symbol: sym,
    name: d.name,
    price: d.price,
    prevClose: d.prevClose ?? d.price,
    percent: d.percent ?? 0,
    volume: d.volume ?? 0,
    extra: true,
  });
}

// ---------- Add holding ----------
document.getElementById("holdingForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const sym = symbolInput.value.trim().toUpperCase();
  const buyPrice = parseFloat(document.getElementById("hPrice").value);
  const qty = parseInt(document.getElementById("hQty").value, 10);

  if (!/^[A-Z0-9&-]{1,20}$/.test(sym)) {
    showToast("Check the symbol", "Enter an NSE symbol such as TCS or M&M");
    return;
  }
  if (!(buyPrice > 0) || !(qty > 0)) return;

  try {
    await ensureStock(sym);
    await addHolding(sym, buyPrice, qty);
    form.reset();
    renderPortfolio();
  } catch (err) {
    showToast("Could not add holding", err.message);
  }
});

// ---------- Remove holding ----------
document.getElementById("holdingsBody").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-remove]");
  if (!btn) return;

  try {
    await removeHolding(btn.dataset.remove);
    renderPortfolio();
  } catch (err) {
    showToast("Could not remove holding", err.message);
  }
});

// ---------- Render ----------
function renderPortfolio() {
  const all = getHoldings();
  const rows = all
    .map((h) => {
      const s = stocks.find((x) => x.symbol === h.symbol);
      if (!s) return null; // its price is still loading
      const invested = h.buyPrice * h.qty;
      const current = s.price * h.qty;
      const pl = current - invested;
      return { ...h, name: s.name, ltp: s.price, invested, current, pl, ret: (pl / invested) * 100 };
    })
    .filter(Boolean);

  const totalInvested = rows.reduce((sum, r) => sum + r.invested, 0);
  const totalCurrent = rows.reduce((sum, r) => sum + r.current, 0);
  const totalPL = totalCurrent - totalInvested;
  const totalRet = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

  document.getElementById("sumInvested").textContent = money(totalInvested);
  document.getElementById("sumCurrent").textContent = money(totalCurrent);

  const plEl = document.getElementById("sumPL");
  plEl.textContent = signedMoney(totalPL);
  plEl.className = dirClass(totalPL);

  const retEl = document.getElementById("sumReturn");
  retEl.textContent = sign(totalRet) + totalRet.toFixed(2) + "%";
  retEl.className = dirClass(totalRet);

  document.getElementById("holdingsTable").hidden = rows.length === 0;
  document.getElementById("holdingsEmpty").hidden = all.length > 0;

  document.getElementById("holdingsBody").innerHTML = rows
    .map(
      (r) => `<tr>
        <td>
          <a class="sym" href="stock.html?symbol=${encodeURIComponent(r.symbol)}">${escHtml(r.symbol)}</a>
          <span class="co">${escHtml(r.name)}</span>
        </td>
        <td>${r.qty}</td>
        <td>${fmtPrice(r.buyPrice)}</td>
        <td>${fmtPrice(r.ltp)}</td>
        <td>${fmtPrice(r.invested)}</td>
        <td>${fmtPrice(r.current)}</td>
        <td class="${dirClass(r.pl)}">${signedMoney(r.pl)}</td>
        <td class="${dirClass(r.ret)}">${sign(r.ret)}${r.ret.toFixed(2)}%</td>
        <td><button class="link-btn" data-remove="${r._id}">Remove</button></td>
      </tr>`
    )
    .join("");
  renderInsights(rows);
}

// ---------- Extra summary: today's profit/loss, best and worst holding, where the money is ----------
function renderInsights(rows) {
  let box = document.getElementById("pfInsights");
  if (!box) {
    document.getElementById("holdingsTable").insertAdjacentHTML("beforebegin", '<div id="pfInsights" class="card"></div>');
    box = document.getElementById("pfInsights");
  }
  if (!rows.length) {
    box.hidden = true;
    return;
  }
  box.hidden = false;

  // Today's change: price now compared with yesterday's close
  const today = rows.reduce((sum, r) => {
    const st = stocks.find((x) => x.symbol === r.symbol);
    const prev = st.prevClose || (st.percent > -100 ? r.ltp / (1 + st.percent / 100) : r.ltp);
    return sum + (r.ltp - prev) * r.qty;
  }, 0);
  const currentTotal = rows.reduce((sum, r) => sum + r.current, 0);
  const todayPct = currentTotal - today > 0 ? (today / (currentTotal - today)) * 100 : 0;

  // Best and worst count all purchases of the same stock together
  const agg = new Map();
  rows.forEach((r) => {
    const a = agg.get(r.symbol) || { symbol: r.symbol, invested: 0, current: 0 };
    a.invested += r.invested;
    a.current += r.current;
    agg.set(r.symbol, a);
  });
  const byReturn = [...agg.values()]
    .map((a) => ({ symbol: a.symbol, ret: ((a.current - a.invested) / a.invested) * 100 }))
    .sort((a, b) => b.ret - a.ret);
  const best = byReturn[0];
  const worst = byReturn[byReturn.length - 1];

  // One bar per stock; several purchases of the same stock count together
  const bySymbol = new Map();
  rows.forEach((r) => bySymbol.set(r.symbol, (bySymbol.get(r.symbol) || 0) + r.current));
  const parts = [...bySymbol.entries()].sort((a, b) => b[1] - a[1]);
  const COLORS = ["#2962ff", "#16c784", "#f7a600", "#b44cf0", "#00bcd4", "#ea3943", "#8d99ae"];
  const shown = parts.slice(0, 6);
  const others = parts.slice(6).reduce((sum, p) => sum + p[1], 0);
  if (others > 0) shown.push(["Others", others]);
  const pct = (v) => (currentTotal > 0 ? (v / currentTotal) * 100 : 0);

  const bar = shown
    .map(([sym, v], i) => `<span title="${escHtml(sym)} ${pct(v).toFixed(1)}%" style="flex:${v};background:${COLORS[i % COLORS.length]};height:100%"></span>`)
    .join("");
  const legend = shown
    .map(([sym, v], i) => `<span style="margin-right:12px;white-space:nowrap"><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${COLORS[i % COLORS.length]};margin-right:4px"></i>${escHtml(sym)} ${pct(v).toFixed(1)}%</span>`)
    .join("");

  box.innerHTML =
    '<div style="display:flex;flex-wrap:wrap;gap:24px;margin-bottom:12px">' +
    `<div><small>Today's profit/loss</small><br><b class="${dirClass(today)}">${signedMoney(today)} (${sign(todayPct)}${todayPct.toFixed(2)}%)</b></div>` +
    `<div><small>Best holding</small><br><b>${escHtml(best.symbol)} <span class="${dirClass(best.ret)}">${sign(best.ret)}${best.ret.toFixed(2)}%</span></b></div>` +
    (byReturn.length > 1
      ? `<div><small>Worst holding</small><br><b>${escHtml(worst.symbol)} <span class="${dirClass(worst.ret)}">${sign(worst.ret)}${worst.ret.toFixed(2)}%</span></b></div>`
      : "") +
    "</div>" +
    '<small>Where your money is</small><div style="display:flex;height:12px;border-radius:6px;overflow:hidden;margin:6px 0">' +
    bar +
    '</div><div style="font-size:13px">' +
    legend +
    "</div>";
}

window.addEventListener("pricetick", renderPortfolio);
window.addEventListener("userdataloaded", renderPortfolio);
renderPortfolio();