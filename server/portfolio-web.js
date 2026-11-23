// Run this inside the frontend folder:  node portfolio-web.js
const fs = require("fs");
const file = "portfolio.js";
let s = fs.readFileSync(file, "utf8");
if (s.includes("renderInsights")) {
  console.log("portfolio.js: already patched, skipped");
} else {
  const crlf = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");

  const steps = [
    [
      "    .join(\"\");\n}\n\nwindow.addEventListener(\"pricetick\", renderPortfolio);",
      `    .join("");
  renderInsights(rows);
}

// ---------- Extra summary: today's profit/loss, best and worst holding, where the money is ----------
function renderInsights(rows) {
  let box = document.getElementById("pfInsights");
  if (!box) {
    document.getElementById("holdingsTable").insertAdjacentHTML("beforebegin", '<div id="pfInsights" class="card"></div>');
    box = document.getElementById("pfInsights");
  }
  if (!rows.length) {
    box.hidden = true;
    return;
  }
  box.hidden = false;

  // Today's change: price now compared with yesterday's close
  const today = rows.reduce((sum, r) => {
    const st = stocks.find((x) => x.symbol === r.symbol);
    const prev = st.prevClose || (st.percent > -100 ? r.ltp / (1 + st.percent / 100) : r.ltp);
    return sum + (r.ltp - prev) * r.qty;
  }, 0);
  const currentTotal = rows.reduce((sum, r) => sum + r.current, 0);
  const todayPct = currentTotal - today > 0 ? (today / (currentTotal - today)) * 100 : 0;

  // Best and worst count all purchases of the same stock together
  const agg = new Map();
  rows.forEach((r) => {
    const a = agg.get(r.symbol) || { symbol: r.symbol, invested: 0, current: 0 };
    a.invested += r.invested;
    a.current += r.current;
    agg.set(r.symbol, a);
  });
  const byReturn = [...agg.values()]
    .map((a) => ({ symbol: a.symbol, ret: ((a.current - a.invested) / a.invested) * 100 }))
    .sort((a, b) => b.ret - a.ret);
  const best = byReturn[0];
  const worst = byReturn[byReturn.length - 1];

  // One bar per stock; several purchases of the same stock count together
  const bySymbol = new Map();
  rows.forEach((r) => bySymbol.set(r.symbol, (bySymbol.get(r.symbol) || 0) + r.current));
  const parts = [...bySymbol.entries()].sort((a, b) => b[1] - a[1]);
  const COLORS = ["#2962ff", "#16c784", "#f7a600", "#b44cf0", "#00bcd4", "#ea3943", "#8d99ae"];
  const shown = parts.slice(0, 6);
  const others = parts.slice(6).reduce((sum, p) => sum + p[1], 0);
  if (others > 0) shown.push(["Others", others]);
  const pct = (v) => (currentTotal > 0 ? (v / currentTotal) * 100 : 0);

  const bar = shown
    .map(([sym, v], i) => \`<span title="\${escHtml(sym)} \${pct(v).toFixed(1)}%" style="flex:\${v};background:\${COLORS[i % COLORS.length]};height:100%"></span>\`)
    .join("");
  const legend = shown
    .map(([sym, v], i) => \`<span style="margin-right:12px;white-space:nowrap"><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:\${COLORS[i % COLORS.length]};margin-right:4px"></i>\${escHtml(sym)} \${pct(v).toFixed(1)}%</span>\`)
    .join("");

  box.innerHTML =
    '<div style="display:flex;flex-wrap:wrap;gap:24px;margin-bottom:12px">' +
    \`<div><small>Today's profit/loss</small><br><b class="\${dirClass(today)}">\${signedMoney(today)} (\${sign(todayPct)}\${todayPct.toFixed(2)}%)</b></div>\` +
    \`<div><small>Best holding</small><br><b>\${escHtml(best.symbol)} <span class="\${dirClass(best.ret)}">\${sign(best.ret)}\${best.ret.toFixed(2)}%</span></b></div>\` +
    (byReturn.length > 1
      ? \`<div><small>Worst holding</small><br><b>\${escHtml(worst.symbol)} <span class="\${dirClass(worst.ret)}">\${sign(worst.ret)}\${worst.ret.toFixed(2)}%</span></b></div>\`
      : "") +
    "</div>" +
    '<small>Where your money is</small><div style="display:flex;height:12px;border-radius:6px;overflow:hidden;margin:6px 0">' +
    bar +
    '</div><div style="font-size:13px">' +
    legend +
    "</div>";
}

window.addEventListener("pricetick", renderPortfolio);`,
    ],
  ];

  for (const [from, to] of steps) {
    if (!s.includes(from)) throw new Error("portfolio.js: could not find this text:\n" + from);
    s = s.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? s.replace(/\n/g, "\r\n") : s);
  console.log("portfolio.js: patched");
}
