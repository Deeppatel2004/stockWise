const express = require("express");
const { protect } = require("../middleware/auth");
const { getQuotes } = require("../services/stockService");
const {
  isValidSymbol,
  isValidRange,
  isBase,
  getDetails,
  getHistory,
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

// GET /api/stocks/search?q=mahindra  ->  [{ symbol, name }]
router.get("/search", async (req, res) => {
  res.json(await searchStocks(req.query.q));
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
