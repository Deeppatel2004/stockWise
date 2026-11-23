const express = require("express");
const { protect } = require("../middleware/auth");
const { getQuotes } = require("../services/stockService");
const {
  isValidSymbol,
  isValidRange,
  isBase,
  getDetails,
  getHistory,
  getIndexHistory,
  isIndexId,
  getExtraQuotes,
  searchStocks,
  MAX_EXTRA_SYMBOLS,
} = require("../services/marketData");

const router = express.Router();
router.use(protect);

// GET /api/stocks/quotes?symbols=MARUTI,M%26M
// The built-in stocks and indices, plus live prices for any extra symbols you ask for
router.get("/quotes", async (req, res) => {
  const base = await getQuotes();

  const wanted = String(req.query.symbols || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => isValidSymbol(s) && !isBase(s));
  const symbols = [...new Set(wanted)].slice(0, MAX_EXTRA_SYMBOLS);

  const extra = symbols.length ? await getExtraQuotes(symbols) : [];
  res.json({ ...base, stocks: [...base.stocks, ...extra] });
});

// GET /api/stocks/screener  ->  live prices for about 50 big companies (for gainers, losers and most active)
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

// GET /api/stocks/search?q=mahindra  ->  [{ symbol, name }]
router.get("/search", async (req, res) => {
  res.json(await searchStocks(req.query.q));
});

// GET /api/stocks/indices/NIFTY50/history?range=1M  (NIFTY50, SENSEX or BANKNIFTY)
router.get("/indices/:id/history", async (req, res) => {
  const id = req.params.id.toUpperCase();
  const range = String(req.query.range || "1M").toUpperCase();
  if (!isIndexId(id)) return res.status(404).json({ message: "Unknown index" });
  if (!isValidRange(range)) return res.status(400).json({ message: "Range must be 1D, 1W, 1M, 6M, 1Y or 5Y" });

  try {
    res.json(await getIndexHistory(id, range));
  } catch (err) {
    res.status(err.status || 503).json({ message: err.message });
  }
});

// GET /api/stocks/TCS  ->  name, price, open, high, low, 52-week range, market cap, P/E, about
router.get("/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  if (!isValidSymbol(symbol)) return res.status(400).json({ message: "Invalid stock symbol" });

  try {
    res.json(await getDetails(symbol));
  } catch (err) {
    res.status(err.status || 503).json({ message: err.message });
  }
});

// GET /api/stocks/TCS/history?range=1M  ->  { points: [{ t, c }] }
router.get("/:symbol/history", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const range = String(req.query.range || "1M").toUpperCase();
  if (!isValidSymbol(symbol)) return res.status(400).json({ message: "Invalid stock symbol" });
  if (!isValidRange(range)) return res.status(400).json({ message: "Range must be 1D, 1W, 1M, 6M, 1Y or 5Y" });

  try {
    res.json(await getHistory(symbol, range));
  } catch (err) {
    res.status(err.status || 503).json({ message: err.message });
  }
});

module.exports = router;
