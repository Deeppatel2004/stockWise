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

// ---------- Browser notifications ----------
function renderPushStatus() {
  if (!("Notification" in window)) {
    pushStatus.textContent = "Not supported in this browser";
    pushBtn.hidden = true;
    return;
  }
  const p = Notification.permission;
  pushStatus.textContent =
    p === "granted" ? "Enabled" : p === "denied" ? "Blocked (change it in your browser's site settings)" : "Not enabled";
  pushBtn.hidden = p !== "default";
}

pushBtn.addEventListener("click", () => {
  Notification.requestPermission().then(() => {
    renderPushStatus();
    renderBell();
  });
});

renderPushStatus();
loadSettings();