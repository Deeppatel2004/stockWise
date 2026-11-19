const nodemailer = require("nodemailer");

let transporter = null;

function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
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

async function sendEmail(to, subject, text) {
  if (!isEmailConfigured()) {
    throw new Error("Email is not set up on the server (SMTP settings are missing in .env)");
  }
  const footer = "StockWise - Data may be delayed. Not financial advice.";
  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text: `${text}\n\n${footer}`,
    html: `<p style="font-size:16px">${escapeHtml(text)}</p><p style="color:#888;font-size:12px">${footer}</p>`,
  });
}

module.exports = { isEmailConfigured, sendEmail };
