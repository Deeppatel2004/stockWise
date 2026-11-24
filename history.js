// Alert history: the alerts that fired
const escHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const historyBox = document.getElementById("historyList");
const historyCount = document.getElementById("historyCount");

const firedWhen = (a) => new Date(a.triggeredAt || a.updatedAt || a.createdAt);

function renderHistory() {
  const fired = getAlerts()
    .filter((a) => a.triggered)
    .sort((a, b) => firedWhen(b) - firedWhen(a));

  historyCount.textContent = fired.length
    ? fired.length + (fired.length === 1 ? " alert has fired" : " alerts have fired")
    : "";

  if (!fired.length) {
    historyBox.innerHTML = '<div class="setting-row first"><div><b>No alerts have fired yet</b><span>When a price alert is reached, it shows up here.</span></div></div>';
    return;
  }

  historyBox.innerHTML = fired
    .map((a, i) => {
      const when = firedWhen(a).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const price = a.triggeredPrice != null ? "Price when it fired: <strong>\u20B9" + fmtPrice(a.triggeredPrice) + "</strong> \u00B7 " : "";
      return `<div class="setting-row${i === 0 ? " first" : ""}">
        <div>
          <b><a href="stock.html?symbol=${encodeURIComponent(a.symbol)}">${escHtml(a.symbol)}</a>
            <span class="${a.condition === "above" ? "up" : "down"}">went ${a.condition === "above" ? "above" : "below"} \u20B9${fmtPrice(a.target)}</span></b>
          <span>${price}${when}</span>
        </div>
        <button class="btn" data-remove="${a._id}">Remove</button>
      </div>`;
    })
    .join("");
}

historyBox.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-remove]");
  if (!btn) return;
  btn.disabled = true;
  try {
    await api("/alerts/" + btn.dataset.remove, "DELETE");
    userData.alerts = userData.alerts.filter((a) => a._id !== btn.dataset.remove);
    renderHistory();
  } catch (err) {
    btn.disabled = false;
  }
});

window.addEventListener("userdataloaded", renderHistory);
window.addEventListener("pricetick", renderHistory);
renderHistory();
