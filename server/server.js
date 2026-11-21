require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const { startAlertJob } = require("./jobs/alertJob");

const app = express();

app.use(cors()); // open in development; restrict to your site's URL when you deploy
app.use(express.json());

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
