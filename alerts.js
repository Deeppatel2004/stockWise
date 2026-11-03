// ---------- Small storage helpers ----------
function loadList(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}
function saveList(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

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

// ---------- Price alerts ----------
function getAlerts() {
  return loadList("alerts");
}

function addAlert(symbol, condition, target) {
  const list = getAlerts();
  list.push({ id: Date.now(), symbol, condition, target, triggered: false });
  saveList("alerts", list);
}

function removeAlert(id) {
  saveList("alerts", getAlerts().filter((a) => a.id !== id));
}

function checkAlerts() {
  const alerts = getAlerts();
  let changed = false;

  alerts.forEach((a) => {
    if (a.triggered) return; // each alert fires only once
    const s = stocks.find((x) => x.symbol === a.symbol);
    if (!s) return;

    const hit = a.condition === "above" ? s.price >= a.target : s.price <= a.target;
    if (hit) {
      a.triggered = true;
      changed = true;
      pushNotification(
        `${a.symbol} price alert`,
        `${a.symbol} is now ₹${fmtPrice(s.price)} (${a.condition} your target ₹${fmtPrice(a.target)})`
      );
    }
  });

  if (changed) saveList("alerts", alerts);
}

// ---------- Notifications ----------
function getNotifications() {
  return loadList("notifications");
}

function pushNotification(title, message) {
  const list = getNotifications();
  list.unshift({ title, message, time: new Date().toISOString(), read: false });
  saveList("notifications", list.slice(0, 50)); // keep the latest 50

  renderBell();
  showToast(title, message);

  // Browser notification (only if the user allowed it)
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body: message });
  }
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
            <small>${new Date(n.time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</small>
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
  saveList("notifications", getNotifications().map((n) => ({ ...n, read: true })));
  renderBell();
});

document.getElementById("clearAll").addEventListener("click", () => {
  saveList("notifications", []);
  renderBell();
});

document.getElementById("enablePush").addEventListener("click", () => {
  Notification.requestPermission().then(renderBell);
});

// Keep the bell in sync if another tab changes the data
window.addEventListener("storage", renderBell);

renderBell();