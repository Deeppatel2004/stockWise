// Run this inside the server folder:  node bse-server.js
const fs = require("fs");
const file = "services/marketData.js";
let s = fs.readFileSync(file, "utf8");
if (s.includes("wantsBse")) {
  console.log("marketData.js: already patched, skipped");
} else {
  const crlf = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");

  const steps = [
    [
      'const yahooFor = (symbol) => OVERRIDES.get(symbol) || symbol + ".NS";',
      '// BSE stocks are written with -BO at the end (for example ABC-BO); NSE stocks have no ending\nconst yahooFor = (symbol) => OVERRIDES.get(symbol) || (/-BO$/.test(symbol) ? symbol.slice(0, -3) + ".BO" : symbol + ".NS");',
    ],
    [
      `      remote = (res.quotes || [])
        .filter((q) => typeof q.symbol === "string" && q.symbol.endsWith(".NS"))
        .map((q) => ({ symbol: q.symbol.slice(0, -3), name: q.longname || q.shortname || q.symbol }))
        .filter((q) => isValidSymbol(q.symbol));`,
      `      const all = (res.quotes || []).filter((q) => typeof q.symbol === "string");
      const nse = all
        .filter((q) => q.symbol.endsWith(".NS"))
        .map((q) => ({ symbol: q.symbol.slice(0, -3), name: q.longname || q.shortname || q.symbol }));
      // BSE: shown when the company is not on NSE, or when you typed -BO yourself (for example RELIANCE-BO)
      const nseNames = new Set(nse.map((q) => q.symbol));
      const bse = all
        .filter((q) => q.symbol.endsWith(".BO"))
        .map((q) => ({ symbol: q.symbol.slice(0, -3) + "-BO", name: (q.longname || q.shortname || q.symbol) + " (BSE)" }))
        .filter((q) => wantsBse || !nseNames.has(q.symbol.slice(0, -3)));
      remote = (wantsBse ? bse : [...nse, ...bse]).filter((q) => isValidSymbol(q.symbol));`,
    ],
    [
      "      const res = await svc.withTimeout(yf.search(query, { quotesCount: 15, newsCount: 0 }), SEARCH_TIMEOUT);",
      "      const res = await svc.withTimeout(yf.search(searchText, { quotesCount: 20, newsCount: 0 }), SEARCH_TIMEOUT);",
    ],
    [
      "  const key = query.toLowerCase();\n",
      '  const key = query.toLowerCase();\n  const wantsBse = /[-.]bo$/i.test(query); // "RELIANCE-BO" or "RELIANCE.BO": look at the BSE listing\n  const searchText = query.replace(/[-.]bo$/i, "").trim() || query;\n',
    ],
  ];

  for (const [from, to] of steps) {
    if (!s.includes(from)) throw new Error("marketData.js: could not find this text:\n" + from);
    s = s.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? s.replace(/\n/g, "\r\n") : s);
  console.log("marketData.js: patched");
}
