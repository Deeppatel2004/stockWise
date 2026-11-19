const express = require("express");
const { protect } = require("../middleware/auth");
const { getQuotes } = require("../services/stockService");
const { isKnownSymbol, isValidRange, getDetails, getHistory } = require("../services/marketData");

const router = express.Router();
router.use(protect);

// GET /api/stocks/quotes  ->  { source, stocks: [...], indices: [...] }
router.get("/quotes", async (req, res) => {
  res.json(await getQuotes());
});

// GET /api/stocks/TCS  ->  open, high, low, 52-week range, market cap, P/E
router.get("/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  if (!isKnownSymbol(symbol)) return res.status(404).json({ message: "Unknown stock" });

  try {
    res.json(await getDetails(symbol));
  } catch (err) {
    res.status(503).json({ message: err.message });
  }
});

// GET /api/stocks/TCS/history?range=1M  ->  { points: [{ t, c }] }
router.get("/:symbol/history", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const range = String(req.query.range || "1M").toUpperCase();
  if (!isKnownSymbol(symbol)) return res.status(404).json({ message: "Unknown stock" });
  if (!isValidRange(range)) return res.status(400).json({ message: "Range must be 1D, 1W, 1M, 6M, 1Y or 5Y" });

  try {
    res.json(await getHistory(symbol, range));
  } catch (err) {
    res.status(503).json({ message: err.message });
  }
});

module.exports = router;
