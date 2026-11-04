const express = require("express");
const { protect } = require("../middleware/auth");

const router = express.Router();
router.use(protect);

// GET /api/watchlist  ->  ["TCS", "INFY"]
router.get("/", (req, res) => {
  res.json(req.user.watchlist);
});

// POST /api/watchlist  { symbol }
router.post("/", async (req, res) => {
  const symbol = String((req.body || {}).symbol || "").trim().toUpperCase();
  if (!symbol) return res.status(400).json({ message: "Symbol is required" });

  if (!req.user.watchlist.includes(symbol)) {
    req.user.watchlist.push(symbol);
    await req.user.save();
  }
  res.status(201).json(req.user.watchlist);
});

// DELETE /api/watchlist/:symbol
router.delete("/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  req.user.watchlist = req.user.watchlist.filter((s) => s !== symbol);
  await req.user.save();
  res.json(req.user.watchlist);
});

module.exports = router;