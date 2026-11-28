(function () {
  const css = document.createElement("style");
  css.textContent = `
  .ticker:hover #tickerTrack{animation-play-state:paused}
  .card.fs-on{background:var(--bg,#0b1020);padding:0!important;margin:0;border:0;border-radius:0;overflow:hidden}
  .card.fs-on > *:not(.chart-wrap):not(.tv-box):not(.fs-exit):not(:has(.chart-wrap)):not(:has(.tv-box)){display:none!important}
  .card.fs-on .chart-wrap{height:100vh!important}
  .card.fs-on .tv-box{height:100vh!important}
  .fs-exit{position:fixed!important;top:10px;right:14px;z-index:10001;background:rgba(19,28,46,.85)!important;backdrop-filter:blur(4px)}
  .card.fs-fake{position:fixed;inset:0;z-index:9998;border-radius:0}`;
  document.head.appendChild(css);

  function resizeChart() {
    setTimeout(() => {
      try {
        const pb = document.getElementById("priceChart");
        if (typeof chart !== "undefined" && chart && pb) chart.resize(pb.clientWidth, pb.clientHeight);
      } catch (e) {}
    }, 150);
  }
  function setFs(card, on) {
    card.classList.toggle("fs-on", on);
    const b = document.getElementById("fsBtn");
    if (b) {
      b.textContent = on ? "✕ Exit full screen" : "⛶ Full screen";
      b.classList.toggle("fs-exit", on);
      if (on) card.appendChild(b); // the other buttons are hidden, so the exit button floats over the chart
      else addBtn(); // put it back with the chart buttons
    }
    resizeChart();
  }
  function toggle() {
    const card = document.getElementById("tfButtons").closest(".card");
    const on = !card.classList.contains("fs-on");
    if (on) {
      if (card.requestFullscreen) card.requestFullscreen().catch(() => { card.classList.add("fs-fake"); });
      else card.classList.add("fs-fake");
      setFs(card, true);
    } else {
      card.classList.remove("fs-fake");
      if (document.fullscreenElement) document.exitFullscreen();
      setFs(card, false);
    }
  }
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
      const c = document.querySelector(".card.fs-on");
      if (c && !c.classList.contains("fs-fake")) setFs(c, false);
    } else resizeChart();
  });
  window.addEventListener("resize", resizeChart);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { const c = document.querySelector(".card.fs-fake"); if (c) { c.classList.remove("fs-fake"); setFs(c, false); } }
  });

  function addBtn() {
    const row = document.getElementById("chartModes") || document.getElementById("tfButtons");
    if (!row) return;
    const old = document.getElementById("fsBtn");
    if (old) { if (!old.classList.contains("fs-exit") && old.parentNode !== row) row.appendChild(old); return; }
    const b = document.createElement("button");
    b.id = "fsBtn"; b.type = "button"; b.className = "tf-btn"; b.textContent = "⛶ Full screen";
    b.addEventListener("click", toggle);
    row.appendChild(b);
  }
  const view = document.getElementById("stockView");
  if (view) { new MutationObserver(addBtn).observe(view, { childList: true, subtree: true }); addBtn(); }
})();