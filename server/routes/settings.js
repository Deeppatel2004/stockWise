const express = require("express");
const { protect } = require("../middleware/auth");
const { isEmailConfigured, sendEmail } = require("../services/emailService");

const router = express.Router();
router.use(protect);

const publicSettings = (user) => ({
  inApp: user.notificationSettings?.inApp !== false,
  email: Boolean(user.notificationSettings?.email),
  emailConfigured: isEmailConfigured(),
  emailAddress: user.email,
});

// GET /api/settings
router.get("/", (req, res) => {
  res.json(publicSettings(req.user));
});

// PUT /api/settings  { inApp?: boolean, email?: boolean }
router.put("/", async (req, res) => {
  const body = req.body || {};
  ["inApp", "email"].forEach((key) => {
    if (typeof body[key] === "boolean") req.user.notificationSettings[key] = body[key];
  });
  await req.user.save();
  res.json(publicSettings(req.user));
});

// POST /api/settings/test-email  (sends a test email to the logged-in user)
router.post("/test-email", async (req, res) => {
  try {
    await sendEmail(
      req.user.email,
      "StockWise test email",
      "This is a test email from StockWise. Email alerts are working."
    );
    res.json({ message: `Test email sent to ${req.user.email}` });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
