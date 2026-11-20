const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const PasswordReset = require("../models/PasswordReset");
const { isEmailConfigured, sendEmail } = require("../services/emailService");

const router = express.Router();

const LINK_MINUTES = 30;
const COOLDOWN_MS = 60 * 1000; // at most one reset email per account per minute
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");

// Creates a one-time link and emails it. Does nothing if the account does not exist.
async function sendResetEmail(email) {
  const website = (process.env.FRONTEND_URL || "").replace(/\/+$/, "");
  if (!website) return console.warn("Password reset skipped: FRONTEND_URL is not set");
  if (!isEmailConfigured()) return console.warn("Password reset skipped: SMTP is not set up");

  const user = await User.findOne({ email });
  if (!user) return;

  const recent = await PasswordReset.findOne({ user: user._id, createdAt: { $gt: new Date(Date.now() - COOLDOWN_MS) } });
  if (recent) return;

  const token = crypto.randomBytes(32).toString("hex");
  await PasswordReset.deleteMany({ user: user._id }); // older links stop working
  await PasswordReset.create({
    user: user._id,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + LINK_MINUTES * 60 * 1000),
  });

  await sendEmail(
    user.email,
    "StockWise password reset",
    `Hi ${user.name},\n\n` +
      `We received a request to reset your StockWise password. ` +
      `Open this link to choose a new password (it works for ${LINK_MINUTES} minutes, one time only):\n\n` +
      `${website}/reset.html?token=${token}\n\n` +
      `If you did not ask for this, ignore this email. Your password stays the same.`
  );
}

// POST /api/password/forgot  { email }
router.post("/forgot", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (email.length > 200 || !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ message: "Enter a valid email address" });
  }

  // The answer is the same whether or not the account exists, so nobody can test which emails are registered
  res.json({ message: "If an account exists for that email, a reset link has been sent." });

  try {
    await sendResetEmail(email);
  } catch (err) {
    console.error("Password reset failed:", err.message);
  }
});

// POST /api/password/reset  { token, password }
router.post("/reset", async (req, res) => {
  const { token, password } = req.body || {};

  if (typeof password !== "string" || password.length < 8 || password.length > 100) {
    return res.status(400).json({ message: "Password must be 8 to 100 characters" });
  }
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({ message: "This reset link is invalid or has expired" });
  }

  // Take the link out of the database in one step, so it can only be used once
  const link = await PasswordReset.findOneAndDelete({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } });
  if (!link) return res.status(400).json({ message: "This reset link is invalid or has expired" });

  const hash = await bcrypt.hash(password, 12);
  await User.updateOne({ _id: link.user }, { $set: { password: hash } });
  await PasswordReset.deleteMany({ user: link.user });

  res.json({ message: "Password changed. You can log in now." });

  // Tell the owner that the password changed (a warning if it was not them)
  try {
    const user = await User.findById(link.user);
    if (user && isEmailConfigured()) {
      await sendEmail(
        user.email,
        "Your StockWise password was changed",
        `Hi ${user.name},\n\nYour StockWise password was just changed. If this was not you, reset your password again right away.`
      );
    }
  } catch (err) {
    console.error("Password change email failed:", err.message);
  }
});

module.exports = router;
