const express = require("express");
const Alert = require("../models/Alert");
const { protect } = require("../middleware/auth");

const router = express.Router();
router.use(protect);

// GET /api/alerts
router.get("/", async (req, res) => {
  res.json(await Alert.find({ user: req.user._id }).sort({ createdAt: -1 }));
});

// POST /api/alerts  { symbol, condition: "above" | "below", target }
router.post("/", async (req, res) => {
  const body = req.body || {};
  const symbol = String(body.symbol || "").trim().toUpperCase();
  const condition = body.condition;
  const target = Number(body.target);

  if (!symbol || !["above", "below"].includes(condition) || !(target > 0)) {
    return res.status(400).json({ message: "Valid symbol, condition and target are required" });
  }
  const alert = await Alert.create({ user: req.user._id, symbol, condition, target });
  res.status(201).json(alert);
});

// PUT /api/alerts/:id/trigger  (marks an alert as fired)
router.put("/:id/trigger", async (req, res) => {
  const alert = await Alert.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { triggered: true },
    { new: true }
  );
  if (!alert) return res.status(404).json({ message: "Alert not found" });
  res.json(alert);
});

// DELETE /api/alerts/:id
router.delete("/:id", async (req, res) => {
  const removed = await Alert.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!removed) return res.status(404).json({ message: "Alert not found" });
  res.json({ message: "Deleted" });
});

module.exports = router;