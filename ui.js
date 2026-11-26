(function () {
  const css = document.createElement("style");
  css.textContent = `
  .ticker:hover #tickerTrack{animation-play-state:paused}
  .card.fs-on{background:var(--bg,#0b1020);padding:16px;overflow:auto}
  .card.fs-on #priceChart,.card.fs-on .tv-box{height:calc(100vh - 150px)!important;min-height:300px}
  .card.fs-on .chart-wrap{height:auto}
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
    if (b) b.textContent = on ? "✕ Exit full screen" : "⛶ Full screen";
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
    if (old) { if (old.parentNode !== row) row.appendChild(old); return; }
    const b = document.createElement("button");
    b.id = "fsBtn"; b.type = "button"; b.className = "tf-btn"; b.textContent = "⛶ Full screen";
    b.addEventListener("click", toggle);
    row.appendChild(b);
  }
  const view = document.getElementById("stockView");
  if (view) { new MutationObserver(addBtn).observe(view, { childList: true, subtree: true }); addBtn(); }
})();