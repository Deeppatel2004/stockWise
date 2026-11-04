const express = require("express");
const Notification = require("../models/Notification");
const { protect } = require("../middleware/auth");

const router = express.Router();
router.use(protect);

// GET /api/notifications  (latest 50)
router.get("/", async (req, res) => {
  res.json(await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50));
});

// POST /api/notifications  { title, message }
router.post("/", async (req, res) => {
  const body = req.body || {};
  const title = String(body.title || "").trim().slice(0, 120);
  const message = String(body.message || "").trim().slice(0, 400);
  if (!title || !message) return res.status(400).json({ message: "Title and message are required" });

  const n = await Notification.create({ user: req.user._id, title, message });
  res.status(201).json(n);
});

// PUT /api/notifications/read-all
router.put("/read-all", async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ message: "All marked as read" });
});

// DELETE /api/notifications  (clear all)
router.delete("/", async (req, res) => {
  await Notification.deleteMany({ user: req.user._id });
  res.json({ message: "Cleared" });
});

module.exports = router;