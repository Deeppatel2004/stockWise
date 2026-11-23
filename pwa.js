// Installing the app: the button is in Settings. On an iPhone: Share, then Add to Home Screen.
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

let installEvent = null;
const isInstalled = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installEvent = e;
  showInstallRow();
});
window.addEventListener("appinstalled", () => {
  installEvent = null;
  showInstallRow();
});

// A row under the notification setting on the Settings page
function showInstallRow() {
  const pushBtn = document.getElementById("pushBtn");
  if (!pushBtn) return; // not the Settings page
  let row = document.getElementById("installRow");
  if (!row) {
    const host = pushBtn.parentElement;
    row = document.createElement("div");
    row.id = "installRow";
    row.className = host.className;
    row.style.marginTop = "12px";
    row.innerHTML =
      '<div><b>Install StockWise as an app</b><br><small id="installStatus" style="opacity:.75"></small></div>' +
      '<button type="button" id="installNow" class="' + pushBtn.className + '"></button>';
    host.insertAdjacentElement("afterend", row);
    document.getElementById("installNow").addEventListener("click", async () => {
      if (!installEvent) return;
      installEvent.prompt();
      await installEvent.userChoice;
      installEvent = null;
      showInstallRow();
    });
  }
  const status = document.getElementById("installStatus");
  const btn = document.getElementById("installNow");
  if (isInstalled()) {
    status.textContent = "Already installed on this device";
    btn.hidden = true;
  } else if (installEvent) {
    status.textContent = "Open it from your home screen, full screen, like an app";
    btn.textContent = "Install";
    btn.hidden = false;
  } else if (isIphone()) {
    status.textContent = "On iPhone: tap Share, then Add to Home Screen";
    btn.hidden = true;
  } else {
    status.textContent = "Use your browser menu (three dots) and choose Install app";
    btn.hidden = true;
  }
}
document.addEventListener("DOMContentLoaded", showInstallRow);
