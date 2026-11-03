const symbolSelect = document.getElementById("hSymbol");
symbolSelect.innerHTML = stocks
  .map((s) => `<option value="${s.symbol}">${s.symbol} - ${s.name}</option>`)
  .join("");

function getHoldings() {
  try {
    return JSON.parse(localStorage.getItem("holdings")) || [];
  } catch {
    return [];
  }
}

function saveHoldings(list) {
  localStorage.setItem("holdings", JSON.stringify(list));
}

const money = (n) => "₹" + fmtPrice(n);
const signedMoney = (n) => (n >= 0 ? "+" : "-") + "₹" + fmtPrice(Math.abs(n));

// ---------- Add holding ----------
document.getElementById("holdingForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const buyPrice = parseFloat(document.getElementById("hPrice").value);
  const qty = parseInt(document.getElementById("hQty").value, 10);
  if (!(buyPrice > 0) || !(qty > 0)) return;

  const list = getHoldings();
  list.push({ id: Date.now(), symbol: symbolSelect.value, buyPrice, qty });
  saveHoldings(list);

  e.target.reset();
  renderPortfolio();
});

// ---------- Remove holding ----------
document.getElementById("holdingsBody").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-remove]");
  if (!btn) return;
  saveHoldings(getHoldings().filter((h) => h.id !== Number(btn.dataset.remove)));
  renderPortfolio();
});

// ---------- Render ----------
function renderPortfolio() {
  const rows = getHoldings()
    .map((h) => {
      const s = stocks.find((x) => x.symbol === h.symbol);
      if (!s) return null;
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
  document.getElementById("holdingsEmpty").hidden = rows.length > 0;

  document.getElementById("holdingsBody").innerHTML = rows
    .map(
      (r) => `<tr>
        <td>
          <a class="sym" href="stock.html?symbol=${r.symbol}">${r.symbol}</a>
          <span class="co">${r.name}</span>
        </td>
        <td>${r.qty}</td>
        <td>${fmtPrice(r.buyPrice)}</td>
        <td>${fmtPrice(r.ltp)}</td>
        <td>${fmtPrice(r.invested)}</td>
        <td>${fmtPrice(r.current)}</td>
        <td class="${dirClass(r.pl)}">${signedMoney(r.pl)}</td>
        <td class="${dirClass(r.ret)}">${sign(r.ret)}${r.ret.toFixed(2)}%</td>
        <td><button class="link-btn" data-remove="${r.id}">Remove</button></td>
      </tr>`
    )
    .join("");
}

window.addEventListener("pricetick", renderPortfolio);
renderPortfolio();