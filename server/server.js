require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const { startAlertJob } = require("./jobs/alertJob");

const app = express();

// ---------- Security ----------
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

app.set("trust proxy", 1); // Render sits behind a proxy: needed so limits count real visitors
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));

// Only these websites may call the API from a browser
const ALLOWED_ORIGINS = [
  "https://stockwise-1-zdy1.onrender.com",
  "https://stockwise-l8wv.onrender.com",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://127.0.0.1:5000",
  "http://localhost:5000",
  ...(process.env.EXTRA_ORIGINS ? process.env.EXTRA_ORIGINS.split(",").map((x) => x.trim()) : []),
];
app.use(cors({ origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.includes(origin)) }));

app.use(express.json({ limit: "10kb" }));

const tooMany = { message: "Too many attempts. Please wait a few minutes and try again." };
// Everything: generous, the live prices refresh every 5 seconds
app.use("/api", rateLimit({ windowMs: 60 * 1000, limit: 400, standardHeaders: true, legacyHeaders: false, message: { message: "Too many requests. Slow down." } }));
// Login: 10 failed tries per 15 minutes
app.use("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false, message: tooMany }));
// Sign-up and password reset: 10 per 15 minutes
app.use("/api/auth/register", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: tooMany }));
app.use("/api/password", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: tooMany }));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/stocks", require("./routes/stocks"));
app.use("/api/watchlist", require("./routes/watchlist"));
app.use("/api/holdings", require("./routes/holdings"));
app.use("/api/alerts", require("./routes/alerts"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/password", require("./routes/passwordReset"));
app.use("/api/push", require("./routes/push"));

// Serve the website and its static assets from the same server.
const frontendDir = path.resolve(__dirname, "..");
app.use(express.static(frontendDir, {
  extensions: ["html"],
  setHeaders(res, filePath) {
    if (filePath.endsWith("sw.js")) {
      res.setHeader("Cache-Control", "no-cache");
    }
  },
}));

// 404
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

// Error handler
app.use((err, req, res, next) => {
  if (err.name === "CastError") return res.status(400).json({ message: "Invalid id" });
  console.error(err);
  res.status(500).json({ message: "Server error" });
});

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
    startAlertJob();
  })
  .catch((err) => {
    console.error("Failed to start:", err.message);
    process.exit(1);
  });
