// Run this inside the frontend folder:  node screener-web.js
const fs = require("fs");
const file = "script.js";
let s = fs.readFileSync(file, "utf8");
if (s.includes("screenerPool")) {
  console.log("script.js: already patched, skipped");
} else {
  const crlf = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");

  const steps = [
    [
      "function renderTables() {\n",
      `// About 50 big companies from the server (gainers, losers and most active use them when they have loaded)
let screenerPool = null;
async function loadScreener() {
  try {
    const list = await api("/stocks/screener");
    if (Array.isArray(list) && list.length > 10) {
      screenerPool = list;
      renderTables();
    }
  } catch (err) {
    /* the built-in stocks are used instead */
  }
}

function renderTables() {
`,
    ],
    [
      "  const pool = stocks.filter((s) => !s.extra);\n",
      "  const pool = screenerPool || stocks.filter((s) => !s.extra);\n",
    ],
    [
      "renderWatchlist();\nupdateMarketStatus();\n",
      "renderWatchlist();\nupdateMarketStatus();\nloadScreener();\nsetInterval(() => {\n  if (!document.hidden) loadScreener();\n}, 30 * 1000);\n",
    ],
  ];

  for (const [from, to] of steps) {
    if (!s.includes(from)) throw new Error("script.js: could not find this text:\n" + from);
    s = s.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? s.replace(/\n/g, "\r\n") : s);
  console.log("script.js: patched");
}
