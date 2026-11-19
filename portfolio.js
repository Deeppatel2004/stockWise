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
}

window.addEventListener("pricetick", renderPortfolio);
window.addEventListener("userdataloaded", renderPortfolio);
renderPortfolio();