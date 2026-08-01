// Thin mail wrapper. If SMTP_HOST/SMTP_USER/SMTP_PASS are set (see .env.example),
// real email is sent via nodemailer. Otherwise — e.g. running locally without
// any mail setup — the message is just logged to the server console so the
// forgot-password flow is still usable during development.
const nodemailer = require("nodemailer");

function isConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter = null;
function getTransporter() {
  if (!isConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
  return transporter;
}

// Returns true if a real email was sent, false if it just fell back to logging.
async function sendMail({ to, subject, text, html }) {
  const from = process.env.SMTP_FROM || "SynBase <no-reply@sibrp.local>";
  const t = getTransporter();

  if (!t) {
    console.log("\n[mailer] SMTP is not configured (see .env.example) — logging email instead of sending:");
    console.log(`[mailer] To: ${to}`);
    console.log(`[mailer] Subject: ${subject}`);
    console.log(`[mailer] ${text}\n`);
    return false;
  }

  await t.sendMail({ from, to, subject, text, html });
  return true;
}

module.exports = { sendMail, isConfigured };
