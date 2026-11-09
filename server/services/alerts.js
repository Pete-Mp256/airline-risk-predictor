const { sendMail } = require('./mailer');
const { describeFeature } = require('../utils/features');

// Base URL of the React app, for links in emails.
function appUrl(path = '') {
  return `${(process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')}${path}`;
}

// Incident types, notes and names are user input, so escape them before putting them in HTML.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Wraps body HTML in a plain branded layout (red top bar, white card).
function layout(bodyHtml) {
  return (
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#1f2328;max-width:560px;margin:0 auto">' +
    '<div style="height:6px;background:#c8102e"></div>' +
    `<div style="padding:20px 4px">${bodyHtml}</div>` +
    '<p style="color:#6b7280;font-size:12px;padding:0 4px">Incident Risk Predictor</p></div>'
  );
}

function button(href, label) {
  return (
    `<p><a href="${escapeHtml(href)}" style="display:inline-block;background:#c8102e;color:#fff;` +
    `padding:10px 18px;border-radius:999px;text-decoration:none">${escapeHtml(label)}</a></p>`
  );
}

// Sends one email per recipient so each gets their own greeting. One failed address
// doesn't stop the others; failures are logged and counted.
async function sendToEach(recipients, build) {
  const results = await Promise.allSettled(recipients.map((r) => sendMail({ to: r.email, ...build(r) })));
  const failed = results.filter((r) => r.status === 'rejected');
  failed.forEach((r) => console.error('[alerts] email failed:', r.reason && r.reason.message));
  return { sent: results.length - failed.length, failed: failed.length };
}

// #37: High risk prediction. recipients: [{ email, first_name }]
function emailHighRisk({ incident, shift, prediction, recipients }) {
  const factors = (prediction.top_factors || []).slice(0, 3);
  const confidence = `${Math.round(Number(prediction.confidence) * 100)}%`;
  const link = appUrl(`/incidents/${incident.incident_id}`);
  const reasons = factors.map((f) => `${describeFeature(f.feature, f.value)} ${f.effect === 'raises' ? 'raised' : 'lowered'} the score`);

  return sendToEach(recipients, (r) => ({
    subject: `High risk: ${incident.incident_type} on the ${shift.shift_type} shift`,
    text:
      `Hello ${r.first_name},\n\nIncident #${incident.incident_id} (${incident.incident_type}) on the ` +
      `${shift.shift_type} shift was rated High risk (${confidence}).\n\n` +
      (reasons.length ? `Why:\n${reasons.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\n` : '') +
      `Treat it as a priority at handover and brief the incoming shift.\n${link}`,
    html: layout(
      `<p>Hello ${escapeHtml(r.first_name)},</p>` +
      `<p>Incident #${incident.incident_id} (<strong>${escapeHtml(incident.incident_type)}</strong>) on the ` +
      `${escapeHtml(shift.shift_type)} shift was rated ` +
      `<strong style="color:#d9480f">High risk (${confidence})</strong>.</p>` +
      (reasons.length ? `<p style="margin-bottom:4px">Why the model said this:</p><ol>${reasons.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ol>` : '') +
      '<p>Treat it as a priority at handover and brief the incoming shift.</p>' +
      button(link, 'Open the incident')
    ),
  }));
}

module.exports = { appUrl, escapeHtml, layout, button, sendToEach, emailHighRisk };
