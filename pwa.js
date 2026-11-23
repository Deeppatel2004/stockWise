// Install button (Chrome and Edge). On an iPhone: Share, then Add to Home Screen.
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

let installEvent = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  try {
    if (localStorage.getItem("installDismissed") === "1") return;
  } catch {
    /* storage can be blocked */
  }
  installEvent = e;
  if (document.getElementById("installBtn")) return;
  const box = document.createElement("div");
  box.id = "installBtn";
  box.style.cssText =
    "position:fixed;right:16px;bottom:16px;z-index:9999;display:flex;gap:6px;align-items:center;background:#2962ff;color:#fff;border-radius:10px;padding:8px 12px;box-shadow:0 4px 16px rgba(0,0,0,.35);font:600 14px sans-serif";
  box.innerHTML = '<span style="cursor:pointer">Install StockWise app</span><span title="Hide" style="cursor:pointer;opacity:.8;padding-left:6px">&#10005;</span>';
  box.firstChild.addEventListener("click", async () => {
    installEvent.prompt();
    await installEvent.userChoice;
    box.remove();
  });
  box.lastChild.addEventListener("click", () => {
    try {
      localStorage.setItem("installDismissed", "1");
    } catch {
      /* storage can be blocked */
    }
    box.remove();
  });
  document.body.appendChild(box);
});
window.addEventListener("appinstalled", () => {
  const b = document.getElementById("installBtn");
  if (b) b.remove();
});
