// Sends email. Two ways, chosen by your settings:
//  1) Brevo over HTTPS (BREVO_API_KEY)  - works on Render's free plan, which blocks SMTP
//  2) SMTP, for example Gmail (SMTP_HOST, SMTP_USER, SMTP_PASS)  - works on your own computer
const nodemailer = require("nodemailer");

let transporter = null;

const useBrevo = () => Boolean(process.env.BREVO_API_KEY);
const useSmtp = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

function isEmailConfigured() {
  return useBrevo() || useSmtp();
}

function getTransporter() {
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT) || 465;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // true for 465, false for 587
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// "StockWise <me@gmail.com>"  ->  { name: "StockWise", email: "me@gmail.com" }
function parseSender() {
  const raw = process.env.EMAIL_FROM || process.env.SMTP_USER || "";
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || "StockWise", email: m[2].trim() };
  return { name: "StockWise", email: raw.trim() };
}

async function sendWithBrevo(to, subject, text, html) {
  const sender = parseSender();
  if (!sender.email) throw new Error("EMAIL_FROM is not set (use the sender address you verified in Brevo)");

  let res;
  try {
    res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ sender, to: [{ email: to }], subject, textContent: text, htmlContent: html }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    throw new Error("Could not reach the email service: " + err.message);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error("Email service refused the message: " + (body.message || "status " + res.status));
  }
}

async function sendEmail(to, subject, text) {
  if (!isEmailConfigured()) {
    throw new Error("Email is not set up on the server (add BREVO_API_KEY or the SMTP settings)");
  }
  const footer = "StockWise - Data may be delayed. Not financial advice.";
  const fullText = `${text}\n\n${footer}`;
  const html = `<p style="font-size:16px">${escapeHtml(text).replace(/\n/g, "<br>")}</p><p style="color:#888;font-size:12px">${footer}</p>`;

  if (useBrevo()) return sendWithBrevo(to, subject, fullText, html);

  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text: fullText,
    html,
  });
}

module.exports = { isEmailConfigured, sendEmail };