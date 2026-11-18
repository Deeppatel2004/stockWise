// ---------- Live price simulation (mock) ----------
// Remember yesterday's close so % change can be recalculated on every tick
stocks.forEach((s) => {
  s.prevClose = s.price / (1 + s.percent / 100);
});

function tickPrices() {
  stocks.forEach((s) => {
    s.price = +(s.price * (1 + (Math.random() - 0.5) * 0.006)).toFixed(2); // up to ±0.3%
    s.percent = ((s.price - s.prevClose) / s.prevClose) * 100;
  });
  checkAlerts();
  window.dispatchEvent(new Event("pricetick"));
}
setInterval(tickPrices, 5000);

// ---------- Check price alerts ----------
function checkAlerts() {
  getAlerts().forEach((a) => {
    if (a.triggered) return; // each alert fires only once

    const s = stocks.find((x) => x.symbol === a.symbol);
    if (!s) return;

    const hit = a.condition === "above" ? s.price >= a.target : s.price <= a.target;
    if (hit) {
      a.triggered = true; // mark right away so it cannot fire twice
      api("/alerts/" + a._id + "/trigger", "PUT").catch(() => {});
      pushNotification(
        `${a.symbol} price alert`,
        `${a.symbol} is now ₹${fmtPrice(s.price)} (${a.condition} your target ₹${fmtPrice(a.target)})`
      );
    }
  });
}

// ---------- Notifications ----------
function pushNotification(title, message) {
  const item = { title, message, createdAt: new Date().toISOString(), read: false };
  userData.notifications.unshift(item); // show instantly

  renderBell();
  showToast(title, message);

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body: message });
  }

  // save in the database in the background
  api("/notifications", "POST", { title, message })
    .then((saved) => Object.assign(item, saved))
    .catch((err) => console.error(err));
}

function showToast(title, message) {
  const box = document.getElementById("toastBox");
  if (!box) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<b>${title}</b><span>${message}</span>`;
  box.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

// ---------- Bell UI ----------
function renderBell() {
  const list = getNotifications();
  const unread = list.filter((n) => !n.read).length;

  const count = document.getElementById("bellCount");
  count.textContent = unread;
  count.hidden = unread === 0;

  document.getElementById("bellList").innerHTML = list.length
    ? list
        .map(
          (n) => `<li class="${n.read ? "" : "unread"}">
            <b>${n.title}</b>
            <span>${n.message}</span>
            <small>${new Date(n.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</small>
          </li>`
        )
        .join("")
    : `<li class="empty">No notifications yet</li>`;

  const enableBtn = document.getElementById("enablePush");
  enableBtn.hidden = !("Notification" in window) || Notification.permission !== "default";
}

const bellBtn = document.getElementById("bellBtn");
const bellPanel = document.getElementById("bellPanel");

bellBtn.addEventListener("click", () => {
  bellPanel.hidden = !bellPanel.hidden;
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".bell-wrap")) bellPanel.hidden = true;
});

document.getElementById("markRead").addEventListener("click", () => {
  userData.notifications.forEach((n) => (n.read = true));
  renderBell();
  api("/notifications/read-all", "PUT").catch(() => {});
});

document.getElementById("clearAll").addEventListener("click", () => {
  userData.notifications = [];
  renderBell();
  api("/notifications", "DELETE").catch(() => {});
});

document.getElementById("enablePush").addEventListener("click", () => {
  Notification.requestPermission().then(renderBell);
});

window.addEventListener("userdataloaded", renderBell);
renderBell();