// Web push: sends a notification to the user's browsers even when the website is closed.
const webpush = require("web-push");
const PushSubscription = require("../models/PushSubscription");

let ready = null; // null = not checked yet

function init() {
  if (ready !== null) return ready;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    ready = false;
    return ready;
  }
  try {
    const subject = process.env.VAPID_SUBJECT || "mailto:" + (process.env.SMTP_USER || "admin@example.com");
    webpush.setVapidDetails(subject, pub, priv);
    ready = true;
  } catch (err) {
    console.error("Push is not set up correctly (check the VAPID keys):", err.message);
    ready = false;
  }
  return ready;
}

const isPushConfigured = () => init();
const publicKey = () => process.env.VAPID_PUBLIC_KEY;

// payload: { title, message, url, tag }. Returns how many devices received it.
async function sendPushToUser(userId, payload) {
  if (!init()) return 0;

  const subs = await PushSubscription.find({ user: userId });
  let sent = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 }
        );
        sent++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: s._id }); // the browser removed this subscription
        } else {
          console.error("Push failed:", err.statusCode || err.message);
        }
      }
    })
  );
  return sent;
}

module.exports = { isPushConfigured, publicKey, sendPushToUser };
