const nodemailer = require('nodemailer');

// SMTP settings come from .env (Gmail: smtp.gmail.com, port 465, an App Password).
// Without SMTP_USER/SMTP_PASS, emails are printed to the console so the flow still works in development.
let transport;

function getTransport() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!transport) {
    const port = Number(process.env.SMTP_PORT) || 465;
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transport;
}

async function sendMail({ to, subject, text, html }) {
  const smtp = getTransport();
  if (!smtp) {
    console.log(`[mailer] SMTP not configured. Email to ${to}\nSubject: ${subject}\n${text}`);
    return;
  }
  await smtp.sendMail({
    from: process.env.MAIL_FROM || `Incident Risk Predictor <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  });
}

module.exports = { sendMail };
