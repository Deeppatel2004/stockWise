(function () {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const inr = (n) => "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const css = document.createElement("style");
  css.textContent = `
  .tr-back{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px}
  .tr-box{background:var(--card,#131b2e);color:var(--text,#e6e9f2);border:1px solid var(--border,#26304a);border-radius:12px;width:100%;max-width:400px;overflow:hidden}
  .tr-head{padding:14px 18px;font-weight:700;display:flex;justify-content:space-between;align-items:center}
  .tr-head.buy{background:#2962ff;color:#fff}.tr-head.sell{background:#e5484d;color:#fff}
  .tr-head button{background:none;border:0;color:#fff;font-size:20px;cursor:pointer}
  .tr-body{padding:18px;display:grid;gap:12px}
  .tr-body label{font-size:12px;opacity:.75;display:block;margin-bottom:4px}
  .tr-body input{width:100%;box-sizing:border-box;padding:10px;border-radius:8px;border:1px solid var(--border,#26304a);background:transparent;color:inherit;font-size:15px}
  .tr-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .tr-sum{display:flex;justify-content:space-between;font-size:14px;padding-top:8px;border-top:1px solid var(--border,#26304a)}
  .tr-info{font-size:13px;opacity:.85;min-height:18px}
  .tr-go{padding:12px;border:0;border-radius:8px;color:#fff;font-weight:700;font-size:15px;cursor:pointer}
  .tr-go.buy{background:#2962ff}.tr-go.sell{background:#e5484d}.tr-go:disabled{opacity:.5}
  .tr-bar{display:flex;gap:10px;margin:0 0 14px}
  .tr-btn{padding:10px 28px;border:0;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;font-size:15px}
  .tr-btn.buy{background:#2962ff}.tr-btn.sell{background:#e5484d}`;
  document.head.appendChild(css);

  async function loadStock(sym) {
    let s = stocks.find((x) => x.symbol === sym);
    if (s) return s;
    const d = await api("/stocks/" + encodeURIComponent(sym));
    s = { symbol: sym, name: d.name, price: d.price, prevClose: d.prevClose ?? d.price, percent: d.percent ?? 0, volume: d.volume ?? 0, extra: true };
    stocks.push(s);
    return s;
  }
  const owned = (sym) => getHoldings().filter((h) => h.symbol === sym);
  const ownedQty = (sym) => owned(sym).reduce((a, h) => a + h.qty, 0);

  function openTrade(sym, mode) {
    mode = mode === "sell" ? "sell" : "buy";
    sym = (sym || "").toUpperCase();
    document.querySelectorAll(".tr-back").forEach((e) => e.remove());
    const back = document.createElement("div");
    back.className = "tr-back";
    back.innerHTML = `<div class="tr-box">
      <div class="tr-head ${mode}"><span id="trTitle"></span><button type="button" id="trX" aria-label="Close">×</button></div>
      <div class="tr-body">
        <div><label>Stock</label><input id="trSym" list="trOpts" autocomplete="off" placeholder="Search e.g. TCS, RELIANCE"><datalist id="trOpts"></datalist></div>
        <div class="tr-info" id="trInfo"></div>
        <div class="tr-row">
          <div><label>Quantity</label><input id="trQty" type="number" min="1" step="1" value="1"></div>
          <div><label>${mode === "buy" ? "Buy" : "Sell"} price (₹)</label><input id="trPrice" type="number" min="0.01" step="0.01"></div>
        </div>
        <div class="tr-sum"><span>${mode === "buy" ? "Total cost" : "Total value"}</span><b id="trTotal">₹0.00</b></div>
        <button class="tr-go ${mode}" id="trGo" type="button"></button>
      </div></div>`;
    document.body.appendChild(back);
    const $ = (id) => back.querySelector("#" + id);
    const close = () => back.remove();
    $("trX").onclick = close;
    back.addEventListener("mousedown", (e) => { if (e.target === back) close(); });
    $("trGo").textContent = mode === "buy" ? "Add to portfolio" : "Sell";
    let cur = null;

    const total = () => {
      const t = (parseFloat($("trQty").value) || 0) * (parseFloat($("trPrice").value) || 0);
      $("trTotal").textContent = inr(t);
    };
    const pick = async (sName) => {
      if (!/^[A-Z0-9&-]{1,20}$/.test(sName)) return;
      try {
        cur = await loadStock(sName);
        $("trTitle").textContent = (mode === "buy" ? "Buy " : "Sell ") + cur.symbol;
        $("trPrice").value = Number(cur.price).toFixed(2);
        const q = ownedQty(cur.symbol);
        $("trInfo").innerHTML = esc(cur.name) + " · LTP <b>" + inr(cur.price) + "</b>" + (q ? " · You own <b>" + q + "</b>" : "");
        total();
      } catch (e) {
        cur = null;
        $("trInfo").textContent = "Stock not found";
      }
    };
    $("trTitle").textContent = mode === "buy" ? "Buy" : "Sell";
    $("trSym").value = sym;
    if (sym) { $("trSym").readOnly = mode === "sell"; pick(sym); }

    let t;
    $("trSym").addEventListener("input", () => {
      clearTimeout(t);
      const v = $("trSym").value.trim().toUpperCase();
      if (/^[A-Z0-9&-]{1,20}$/.test(v) && stocks.find((x) => x.symbol === v)) pick(v);
      if (v.length < 2) return;
      t = setTimeout(async () => {
        try {
          const r = await api("/stocks/search?q=" + encodeURIComponent(v));
          $("trOpts").innerHTML = r.map((x) => `<option value="${esc(x.symbol)}">${esc(x.name)}</option>`).join("");
        } catch (e) {}
      }, 300);
    });
    $("trSym").addEventListener("change", () => pick($("trSym").value.trim().toUpperCase()));
    $("trQty").addEventListener("input", total);
    $("trPrice").addEventListener("input", total);

    $("trGo").onclick = async () => {
      const qty = parseInt($("trQty").value, 10);
      const price = parseFloat($("trPrice").value);
      if (!cur) { await pick($("trSym").value.trim().toUpperCase()); }
      if (!cur) { showToast("Pick a stock", "Search and choose a stock first"); return; }
      if (!(qty > 0) || !(price > 0)) { showToast("Check the numbers", "Quantity and price must be above 0"); return; }
      $("trGo").disabled = true;
      try {
        if (mode === "buy") {
          await addHolding(cur.symbol, price, qty);
          showToast("Added " + cur.symbol, qty + " shares at " + inr(price));
        } else {
          const have = ownedQty(cur.symbol);
          if (qty > have) { showToast("Not enough shares", "You own only " + have); $("trGo").disabled = false; return; }
          let left = qty;
          for (const lot of owned(cur.symbol)) {
            if (left <= 0) break;
            if (left >= lot.qty) { await removeHolding(lot._id); left -= lot.qty; }
            else { await addHolding(cur.symbol, lot.buyPrice, lot.qty - left); await removeHolding(lot._id); left = 0; }
          }
          showToast("Sold " + cur.symbol, qty + " shares");
        }
        close();
        if (typeof renderPortfolio === "function") renderPortfolio();
        decorate();
      } catch (e) {
        showToast("Could not complete", e.message);
        $("trGo").disabled = false;
      }
    };
    setTimeout(() => ($("trSym").readOnly ? $("trQty") : $("trSym")).focus(), 50);
  }
  window.openTrade = openTrade;

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-trade]");
    if (b) openTrade(b.dataset.sym || "", b.dataset.trade);
  });

  // Buy / Sell buttons on the stock page
  function decorate() {
    const view = document.getElementById("stockView");
    if (!view) return;
    const sym = (new URLSearchParams(location.search).get("symbol") || "").toUpperCase();
    if (!sym || /^(NIFTY|BANKNIFTY|SENSEX|\^)/.test(sym) || !view.firstElementChild) return;
    let bar = document.getElementById("trBar");
    const html = `<button class="tr-btn buy" data-trade="buy" data-sym="${esc(sym)}">Buy</button>` +
      (typeof getHoldings === "function" && ownedQty(sym) ? `<button class="tr-btn sell" data-trade="sell" data-sym="${esc(sym)}">Sell</button>` : "");
    if (bar && bar.parentNode === view) { if (bar.innerHTML !== html) bar.innerHTML = html; return; }
    bar = document.createElement("div");
    bar.id = "trBar"; bar.className = "tr-bar"; bar.innerHTML = html;
    view.insertBefore(bar, view.firstChild);
  }
  const view = document.getElementById("stockView");
  if (view) {
    new MutationObserver(() => decorate()).observe(view, { childList: true });
    window.addEventListener("userdataloaded", decorate);
    decorate();
  }
})();