const inAppBox = document.getElementById("setInApp");
const emailBox = document.getElementById("setEmail");
const emailAddr = document.getElementById("emailAddr");
const emailWarn = document.getElementById("emailWarn");
const testBtn = document.getElementById("testEmailBtn");
const testMsg = document.getElementById("testEmailMsg");
const pushStatus = document.getElementById("pushStatus");
const pushBtn = document.getElementById("pushBtn");

// ---------- Load + save settings ----------
async function loadSettings() {
  try {
    const s = await api("/settings");
    inAppBox.checked = s.inApp;
    emailBox.checked = s.email;
    emailAddr.textContent = s.emailAddress;
    emailWarn.hidden = s.emailConfigured;
    inAppBox.disabled = false;
    emailBox.disabled = false;
  } catch (err) {
    showToast("Could not load settings", err.message);
  }
}

async function saveSetting(key, box) {
  box.disabled = true;
  try {
    await api("/settings", "PUT", { [key]: box.checked });
    showToast("Saved", "Your notification settings were updated");
  } catch (err) {
    box.checked = !box.checked; // put the switch back
    showToast("Could not save", err.message);
  } finally {
    box.disabled = false;
  }
}

inAppBox.addEventListener("change", () => saveSetting("inApp", inAppBox));
emailBox.addEventListener("change", () => saveSetting("email", emailBox));

// ---------- Test email ----------
testBtn.addEventListener("click", async () => {
  testBtn.disabled = true;
  testMsg.className = "test-msg";
  testMsg.textContent = "Sending…";
  try {
    const res = await api("/settings/test-email", "POST");
    testMsg.className = "test-msg ok";
    testMsg.textContent = res.message;
  } catch (err) {
    testMsg.className = "test-msg bad";
    testMsg.textContent = err.message;
  } finally {
    testBtn.disabled = false;
  }
});

// ---------- Push notifications (work even when the website is closed) ----------
const pushSupported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function setPushFlag(on) {
  try {
    if (on) localStorage.setItem("pushOn", "1");
    else localStorage.removeItem("pushOn");
  } catch {
    /* storage can be blocked */
  }
}

function urlBase64ToUint8Array(base64) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function getPushRegistration() {
  await navigator.serviceWorker.register("sw.js");
  return navigator.serviceWorker.ready;
}

async function renderPushStatus() {
  if (!pushSupported) {
    pushStatus.textContent = "Not supported in this browser";
    pushBtn.hidden = true;
    return;
  }

  if (Notification.permission === "denied") {
    setPushFlag(false);
    pushStatus.textContent = "Blocked (change it in your browser's site settings)";
    pushBtn.hidden = true;
    return;
  }

  let subscribed = false;
  try {
    const reg = await getPushRegistration();
    subscribed = Boolean(await reg.pushManager.getSubscription());
  } catch (err) {
    console.warn("Push check failed:", err.message);
  }

  setPushFlag(subscribed);
  pushStatus.textContent = subscribed ? "On for this device (works even when StockWise is closed)" : "Off";
  pushBtn.textContent = subscribed ? "Turn off" : "Turn on";
  pushBtn.hidden = false;
  pushBtn.disabled = false;
}

async function enablePush() {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications were not allowed");

  const { publicKey } = await api("/push/public-key");
  const reg = await getPushRegistration();
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  await api("/push/subscribe", "POST", sub.toJSON());
  setPushFlag(true);
  await api("/push/test", "POST").catch(() => {}); // a test notification confirms it works
}

async function disablePush() {
  const reg = await getPushRegistration();
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await api("/push/unsubscribe", "POST", { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe();
  }
  setPushFlag(false);
}

pushBtn.addEventListener("click", async () => {
  pushBtn.disabled = true;
  try {
    if (pushBtn.textContent === "Turn off") {
      await disablePush();
      showToast("Push notifications", "Turned off for this device");
    } else {
      await enablePush();
      showToast("Push notifications", "Turned on for this device");
    }
  } catch (err) {
    showToast("Push notifications", err.message);
  }
  renderPushStatus();
  renderBell();
});

renderPushStatus();
loadSettings();