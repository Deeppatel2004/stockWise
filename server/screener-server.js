// Run this inside the server folder:  node screener-server.js
const fs = require("fs");
const file = "routes/stocks.js";
let s = fs.readFileSync(file, "utf8");
if (s.includes("/screener")) {
  console.log("routes/stocks.js: already patched, skipped");
} else {
  const crlf = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");

  const anchor = "// GET /api/stocks/search?q=mahindra";
  if (!s.includes(anchor)) throw new Error("routes/stocks.js: could not find the search route");

  const route = `// GET /api/stocks/screener  ->  live prices for about 50 big companies (for gainers, losers and most active)
const SCREENER_SYMBOLS = [
  "RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "INFY", "BHARTIARTL", "ITC", "SBIN", "LT", "HINDUNILVR",
  "KOTAKBANK", "AXISBANK", "BAJFINANCE", "MARUTI", "SUNPHARMA", "M&M", "NTPC", "ONGC", "TITAN", "ULTRACEMCO",
  "ASIANPAINT", "POWERGRID", "ADANIENT", "ADANIPORTS", "WIPRO", "HCLTECH", "TECHM", "TATASTEEL", "JSWSTEEL", "COALINDIA",
  "NESTLEIND", "BAJAJFINSV", "BAJAJ-AUTO", "TATAMOTORS", "GRASIM", "HINDALCO", "CIPLA", "DRREDDY", "EICHERMOT", "HEROMOTOCO",
  "INDUSINDBK", "SBILIFE", "HDFCLIFE", "BRITANNIA", "APOLLOHOSP", "TRENT", "BEL", "SHRIRAMFIN", "DIVISLAB", "TATACONSUM",
];
const SCREENER_TTL = 30 * 1000;
let screenerCache = { at: 0, data: [] };

router.get("/screener", async (req, res) => {
  if (Date.now() - screenerCache.at < SCREENER_TTL && screenerCache.data.length) return res.json(screenerCache.data);

  try {
    const base = (await getQuotes()).stocks.filter((q) => SCREENER_SYMBOLS.includes(q.symbol));
    const rest = SCREENER_SYMBOLS.filter((sym) => !isBase(sym));
    const extra = await getExtraQuotes(rest);
    const data = [...base, ...extra];
    if (data.length) screenerCache = { at: Date.now(), data };
    res.json(data.length ? data : screenerCache.data);
  } catch (err) {
    res.json(screenerCache.data); // empty: the dashboard keeps its own list
  }
});

`;
  s = s.replace(anchor, () => route + anchor);
  fs.writeFileSync(file, crlf ? s.replace(/\n/g, "\r\n") : s);
  console.log("routes/stocks.js: patched");
}
