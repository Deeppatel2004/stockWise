const express = require("express");
const { protect } = require("../middleware/auth");
const { getQuotes } = require("../services/stockService");

const router = express.Router();
router.use(protect);

// GET /api/stocks/quotes  ->  { source, stocks: [...], indices: [...] }
router.get("/quotes", async (req, res) => {
  res.json(await getQuotes());
});

module.exports = router;