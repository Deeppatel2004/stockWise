const cron = require("node-cron");
const Alert = require("../models/Alert");
const Notification = require("../models/Notification");
const { getQuotes } = require("../services/stockService");

const fmt = (n) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let running = false;

// Checks every untriggered alert against current prices
async function runAlertCheck() {
  if (running) return; // never run two checks at the same time
  running = true;

  try {
    const pending = await Alert.find({ triggered: false });
    if (!pending.length) return;

    const { stocks } = await getQuotes();
    const prices = new Map(stocks.map((s) => [s.symbol, s.price]));

    for (const a of pending) {
      const price = prices.get(a.symbol);
      if (price == null) continue;

      const hit = a.condition === "above" ? price >= a.target : price <= a.target;
      if (!hit) continue;

      // Claim the alert first. If another check already claimed it, skip (no duplicates)
      const claimed = await Alert.findOneAndUpdate({ _id: a._id, triggered: false }, { triggered: true });
      if (!claimed) continue;

      await Notification.create({
        user: a.user,
        title: `${a.symbol} price alert`,
        message: `${a.symbol} is now ₹${fmt(price)} (${a.condition} your target ₹${fmt(a.target)})`,
      });
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
