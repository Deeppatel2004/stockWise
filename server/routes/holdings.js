const express = require("express");
const Holding = require("../models/Holding");
const { protect } = require("../middleware/auth");

const router = express.Router();
router.use(protect);

// GET /api/holdings
router.get("/", async (req, res) => {
  res.json(await Holding.find({ user: req.user._id }).sort({ createdAt: -1 }));
});

// POST /api/holdings  { symbol, buyPrice, qty }
router.post("/", async (req, res) => {
  const body = req.body || {};
  const symbol = String(body.symbol || "").trim().toUpperCase();
  const buyPrice = Number(body.buyPrice);
  const qty = Number(body.qty);

  if (!symbol || !(buyPrice > 0) || !Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ message: "Valid symbol, buyPrice and whole-number qty are required" });
  }
  const holding = await Holding.create({ user: req.user._id, symbol, buyPrice, qty });
  res.status(201).json(holding);
});

// DELETE /api/holdings/:id
router.delete("/:id", async (req, res) => {
  const removed = await Holding.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!removed) return res.status(404).json({ message: "Holding not found" });
  res.json({ message: "Deleted" });
});

module.exports = router;