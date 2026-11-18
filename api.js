const API_URL = "http://127.0.0.1:5000/api";
const onLoginPage = location.pathname.endsWith("login.html");

// ---------- Login session ----------
function getToken() {
  return localStorage.getItem("token");
}

function setSession(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  location.href = "login.html";
}

// Anyone who is not logged in goes to the login page
if (!getToken() && !onLoginPage) location.href = "login.html";

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) logoutBtn.addEventListener("click", logout);

// ---------- Fetch helper ----------
async function api(path, method = "GET", body) {
  let res;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(getToken() && { Authorization: "Bearer " + getToken() }),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the server. Is it running on port 5000?");
  }

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && !onLoginPage) {
    logout(); // token expired or invalid
    throw new Error("Please log in again");
  }
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

// ---------- In-memory copy of the user's data ----------
const userData = { watchlist: [], holdings: [], alerts: [], notifications: [] };

async function loadUserData() {
  try {
    const [watchlist, holdings, alerts, notifications] = await Promise.all([
      api("/watchlist"),
      api("/holdings"),
      api("/alerts"),
      api("/notifications"),
    ]);
    Object.assign(userData, { watchlist, holdings, alerts, notifications });
    window.dispatchEvent(new Event("userdataloaded")); // pages re-draw themselves
  } catch (err) {
    console.error(err);
    showToast("Could not load your data", err.message);
  }
}

// "load" fires after every script on the page has run, so listeners are ready
if (!onLoginPage && getToken()) window.addEventListener("load", loadUserData);

// ---------- Watchlist ----------
function getWatchlist() {
  return userData.watchlist;
}

function toggleWatchlist(symbol) {
  const adding = !userData.watchlist.includes(symbol);
  userData.watchlist = adding
    ? [...userData.watchlist, symbol]
    : userData.watchlist.filter((s) => s !== symbol);

  const request = adding
    ? api("/watchlist", "POST", { symbol })
    : api("/watchlist/" + symbol, "DELETE");
  request.catch((err) => showToast("Could not save watchlist", err.message));

  return adding; // true = added, false = removed
}

// ---------- Holdings ----------
function getHoldings() {
  return userData.holdings;
}

async function addHolding(symbol, buyPrice, qty) {
  const holding = await api("/holdings", "POST", { symbol, buyPrice, qty });
  userData.holdings.unshift(holding);
}

async function removeHolding(id) {
  await api("/holdings/" + id, "DELETE");
  userData.holdings = userData.holdings.filter((h) => h._id !== id);
}

// ---------- Alerts ----------
function getAlerts() {
  return userData.alerts;
}

async function addAlert(symbol, condition, target) {
  const alert = await api("/alerts", "POST", { symbol, condition, target });
  userData.alerts.unshift(alert);
}

async function removeAlert(id) {
  await api("/alerts/" + id, "DELETE");
  userData.alerts = userData.alerts.filter((a) => a._id !== id);
}

// ---------- Notifications ----------
function getNotifications() {
  return userData.notifications;
}