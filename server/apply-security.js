const fs = require("fs");
for (const m of ["helmet", "express-rate-limit"]) {
  try { require.resolve(m); } catch { throw new Error('Package "' + m + '" is not installed. Run: npm install helmet express-rate-limit'); }
}
let s = fs.readFileSync("server.js", "utf8");
const crlf = s.includes("\r\n");
s = s.replace(/\r\n/g, "\n");
if (s.includes("ALLOWED_ORIGINS")) { console.log("server.js: already secured"); process.exit(0); }
const re = /app\.use\(cors\(\)\);[^\n]*\napp\.use\(express\.json\(\)\);/;
if (!re.test(s)) throw new Error("server.js: could not find the cors/json lines");
const block = `// ---------- Security ----------
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
app.use("/api/password", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: tooMany }));`;
s = s.replace(re, () => block);
fs.writeFileSync("server.js", crlf ? s.replace(/\n/g, "\r\n") : s);
console.log("server.js: secured");