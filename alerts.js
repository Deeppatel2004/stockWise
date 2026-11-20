// ---------- Live data from the server ----------
const REFRESH_MS = 20000; // every 20 seconds

// Yesterday's close for the built-in stocks (real values arrive from the server)
stocks.forEach((s) => {
  s.prevClose = s.price / (1 + s.percent / 100);
});

let seenIds = null; // ids of notifications already shown (set after the first data load)

async function refreshPrices() {
  // The built-in stocks always come back. Any other stock (watchlist, holdings, alerts,
  // the open stock page) is requested by its symbol.
  const wanted = new Set(stocks.filter((s) => s.extra).map((s) => s.symbol));
  getWatchlist().forEach((sym) => wanted.add(sym));
  getHoldings().forEach((h) => wanted.add(h.symbol));
  getAlerts().forEach((a) => wanted.add(a.symbol));

  const data = await api("/stocks/quotes?symbols=" + encodeURIComponent([...wanted].join(",")));

  data.stocks.forEach((q) => {
    let s = stocks.find((x) => x.symbol === q.symbol);
    if (!s) {
      s = { symbol: q.symbol, name: q.name, extra: true };
      stocks.push(s);
    }
    s.price = q.price;
    s.prevClose = q.prevClose;
    s.percent = q.percent;
    s.volume = q.volume;
  });

  data.indices.forEach((q) => {
    const i = indices.find((x) => x.name === q.name);
    if (!i) return;
    i.value = q.value;
    i.change = q.change;
    i.percent = q.percent;
  });

  const footer = document.querySelector(".footer");
  if (footer) {
    footer.textContent =
      (data.source === "yahoo" ? "Prices from Yahoo Finance. " : "Simulated prices (live source unavailable). ") +
      "Data may be delayed. Not financial advice.";
  }
}

function browserNotify(title, message) {
  try {
    if (localStorage.getItem("pushOn") === "1") return; // push is on: the service worker shows the notification
  } catch {
    /* storage can be blocked */
  }
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body: message });
  }
}

async function syncAlertsAndNotifications() {
  const [alerts, notifications] = await Promise.all([api("/alerts"), api("/notifications")]);
  userData.alerts = alerts;

  // Popup for notifications the server created since the last check
  if (seenIds) {
    notifications
      .filter((n) => !seenIds.has(n._id))
      .reverse()
      .forEach((n) => {
        showToast(n.title, n.message);
        browserNotify(n.title, n.message);
      });
  }
  seenIds = new Set(notifications.map((n) => n._id));

  userData.notifications = notifications;
  renderBell();
}

async function refreshLive() {
  try {
    await refreshPrices();
    if (seenIds) await syncAlertsAndNotifications(); // only after the first data load
  } catch (err) {
    console.error(err.message);
    return;
  }
  window.dispatchEvent(new Event("pricetick")); // pages redraw
}

if (getToken()) setInterval(refreshLive, REFRESH_MS);

window.addEventListener("userdataloaded", () => {
  if (!seenIds) seenIds = new Set(getNotifications().map((n) => n._id));
  renderBell();
  refreshLive();
});

// ---------- Toast popup ----------
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

renderBell();