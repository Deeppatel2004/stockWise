const express = require("express");
const { protect } = require("../middleware/auth");
const PushSubscription = require("../models/PushSubscription");
const { isPushConfigured, publicKey, sendPushToUser } = require("../services/pushService");

const router = express.Router();
router.use(protect);

const MAX_DEVICES_PER_USER = 10;
const isText = (v, max) => typeof v === "string" && v.length > 0 && v.length <= max;

// GET /api/push/public-key
router.get("/public-key", (req, res) => {
  if (!isPushConfigured()) return res.status(503).json({ message: "Push notifications are not set up on the server" });
  res.json({ publicKey: publicKey() });
});

// POST /api/push/subscribe  { endpoint, keys: { p256dh, auth } }
router.post("/subscribe", async (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!isText(endpoint, 1000) || !endpoint.startsWith("https://") || !isText(keys?.p256dh, 200) || !isText(keys?.auth, 100)) {
    return res.status(400).json({ message: "Invalid push subscription" });
  }

  // Same device again (or another account on this device): update the row
  await PushSubscription.findOneAndUpdate(
    { endpoint },
    { user: req.user._id, keys: { p256dh: keys.p256dh, auth: keys.auth } },
    { upsert: true }
  );

  // Keep only the newest devices
  const all = await PushSubscription.find({ user: req.user._id }).sort({ createdAt: -1 });
  if (all.length > MAX_DEVICES_PER_USER) {
    await PushSubscription.deleteMany({ _id: { $in: all.slice(MAX_DEVICES_PER_USER).map((s) => s._id) } });
  }
  res.status(201).json({ ok: true });
});

// POST /api/push/unsubscribe  { endpoint }
router.post("/unsubscribe", async (req, res) => {
  const { endpoint } = req.body || {};
  if (isText(endpoint, 1000)) await PushSubscription.deleteOne({ endpoint, user: req.user._id });
  res.json({ ok: true });
});

// POST /api/push/test  (sends a test notification to all of your devices)
router.post("/test", async (req, res) => {
  const sent = await sendPushToUser(req.user._id, {
    title: "StockWise",
    message: "Push notifications are working on this device.",
    url: "settings.html",
    tag: "push-test",
    force: true, // show it even while this page is open
  });
  if (!sent) return res.status(400).json({ message: "No device received the notification" });
  res.json({ message: `Sent to ${sent} device${sent > 1 ? "s" : ""}` });
});

module.exports = router;
