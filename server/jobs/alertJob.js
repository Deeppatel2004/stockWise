const cron = require("node-cron");
const Alert = require("../models/Alert");
const Notification = require("../models/Notification");
const User = require("../models/User");
const { getPrices } = require("../services/marketData");
const { isEmailConfigured, sendEmail } = require("../services/emailService");

const fmt = (n) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let running = false;

// Checks every untriggered alert against current prices
async function runAlertCheck() {
  if (running) return; // never run two checks at the same time
  running = true;

  try {
    const pending = await Alert.find({ triggered: false });
    if (!pending.length) return;

    // Real prices only, for every stock that has a pending alert (any NSE stock)
    const prices = await getPrices([...new Set(pending.map((a) => a.symbol))]);
    const users = new Map(); // each user is loaded only once per check

    for (const a of pending) {
      const price = prices.get(a.symbol);
      if (price == null) continue;

      const hit = a.condition === "above" ? price >= a.target : price <= a.target;
      if (!hit) continue;

      // Claim the alert first. If another check already claimed it, skip (no duplicates)
      const claimed = await Alert.findOneAndUpdate({ _id: a._id, triggered: false }, { triggered: true });
      if (!claimed) continue;

      const title = `${a.symbol} price alert`;
      const message = `${a.symbol} is now ₹${fmt(price)} (${a.condition} your target ₹${fmt(a.target)})`;

      const key = String(a.user);
      if (!users.has(key)) users.set(key, await User.findById(a.user));
      const user = users.get(key);
      const prefs = user?.notificationSettings || {};

      // In-app notification (bell + popup)
      if (prefs.inApp !== false) {
        await Notification.create({ user: a.user, title, message });
      }

      // Email
      if (prefs.email && user?.email) {
        if (!isEmailConfigured()) {
          console.warn("Email alert skipped: SMTP is not set up in .env");
        } else {
          try {
            await sendEmail(user.email, `StockWise: ${title}`, message);
          } catch (err) {
            console.error("Email failed:", err.message);
          }
        }
      }

      console.log(`Alert fired: ${a.symbol} ${a.condition} ${a.target}`);
    }
  } catch (err) {
    console.error("Alert check failed:", err.message);
  } finally {
    running = false;
  }
}

function startAlertJob() {
  cron.schedule("* * * * *", runAlertCheck); // every minute
  console.log("Alert job started (checks every minute)");
}

module.exports = { startAlertJob, runAlertCheck };
