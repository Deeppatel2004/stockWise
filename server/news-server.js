// Run this inside the server folder:  node news-server.js
const fs = require("fs");

function patch(file, steps, marker) {
  let s = fs.readFileSync(file, "utf8");
  if (s.includes(marker)) {
    console.log(file + ": already patched, skipped");
    return;
  }
  const crlf = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");
  for (const [from, to] of steps) {
    if (!s.includes(from)) throw new Error(file + ": could not find this text:\n" + from);
    s = s.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? s.replace(/\n/g, "\r\n") : s);
  console.log(file + ": patched");
}

patch(
  "services/marketData.js",
  [
    [
      "module.exports = {",
      `// ---------- News headlines (from Yahoo Finance) ----------
const NEWS_TTL = 10 * 60 * 1000;
const newsCache = new Map();

async function getNews(symbol) {
  const query = symbol ? yahooFor(symbol) : "Sensex Nifty India stock market";
  const hit = newsCache.get(query);
  if (hit && Date.now() - hit.at < NEWS_TTL) return hit.data;

  const url =
    "https://query2.finance.yahoo.com/v1/finance/search?q=" + encodeURIComponent(query) + "&quotesCount=0&listsCount=0&newsCount=10";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; StockWise)" }, signal: controller.signal });
    if (!res.ok) throw new Error("status " + res.status);
    const json = await res.json();
    const data = (json.news || [])
      .filter((n) => n && n.title && /^https?:\\/\\//.test(n.link || ""))
      .slice(0, 10)
      .map((n) => ({
        title: String(n.title).slice(0, 300),
        publisher: String(n.publisher || "").slice(0, 80),
        link: n.link,
        time: n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toISOString() : null,
      }));
    newsCache.set(query, { at: Date.now(), data });
    return data;
  } catch (err) {
    if (hit) return hit.data; // an older list is better than an error
    const e = new Error("News is not available right now");
    e.status = 503;
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  getNews,`,
    ],
  ],
  "getNews"
);

patch(
  "routes/stocks.js",
  [
    ["  isValidSymbol,\n", "  isValidSymbol,\n  getNews,\n"],
    [
      "// GET /api/stocks/search?q=mahindra",
      `// GET /api/stocks/market-news  ->  latest market headlines
router.get("/market-news", async (req, res) => {
  try {
    res.json(await getNews(null));
  } catch (err) {
    res.status(err.status || 503).json({ message: err.message });
  }
});

// GET /api/stocks/TCS/news  ->  latest headlines about one stock
router.get("/:symbol/news", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  if (!isValidSymbol(symbol)) return res.status(400).json({ message: "Invalid stock symbol" });
  try {
    res.json(await getNews(symbol));
  } catch (err) {
    res.status(err.status || 503).json({ message: err.message });
  }
});

// GET /api/stocks/search?q=mahindra`,
    ],
  ],
  "getNews(symbol)"
);