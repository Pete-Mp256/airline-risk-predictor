const { sendMail } = require('./mailer');
const { describeFeature } = require('../utils/features');

// Base URL of the React app, for links in emails.
function appUrl(path = '') {
  return `${(process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')}${path}`;
}

// "Mon 3 Nov, 22:00" in the station's time zone (APP_TIMEZONE, default Nairobi).
function formatTime(value) {
  return new Date(value).toLocaleString('en-GB', {
    timeZone: process.env.APP_TIMEZONE || 'Africa/Nairobi',
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
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

// #38: end-of-shift handover summary for the next manager on duty.
function emailHandoverSummary({ shift, tasks, incidents, recipients }) {
  const link = appUrl(`/shifts/${shift.shift_id}`);
  const title = `${shift.shift_type} shift, ${shift.department_name}`;
  const when = `${formatTime(shift.start_time)} to ${formatTime(shift.end_time)}`;
  const high = incidents.filter((i) => i.risk_level === 'High').length;
  const taskLine = (t) => `${t.title}${t.aircraft_reg ? ` (${t.aircraft_reg})` : ''}: ${t.status}`;
  const incidentLine = (i) => `${formatTime(i.occurred_at)} ${i.incident_type}: ${i.risk_level ? `${i.risk_level} risk` : 'not predicted'}`;

  const textSection = (heading, items, line, empty) =>
    `${heading}\n${items.length ? items.map((x) => `- ${line(x)}`).join('\n') : empty}\n\n`;
  const htmlSection = (heading, items, line, empty) =>
    `<h3 style="font-size:15px;margin:18px 0 6px">${heading}</h3>` +
    (items.length ? `<ul style="padding-left:18px;margin:0">${items.map((x) => `<li>${escapeHtml(line(x))}</li>`).join('')}</ul>` : `<p style="color:#6b7280;margin:0">${empty}</p>`);

  return sendToEach(recipients, (r) => ({
    subject: `Handover: ${title}${high ? `, ${high} High risk` : ''}`,
    text:
      `Hello ${r.first_name},\n\n${shift.manager_name} has handed over the ${title} ` +
      `(${when}, ${shift.staff_count} staff).\n\n` +
      textSection(`Open tasks (${tasks.length})`, tasks, taskLine, 'None') +
      textSection(`Incidents (${incidents.length})`, incidents, incidentLine, 'None logged') +
      `Handover notes\n${shift.notes || 'No notes'}\n\n${link}`,
    html: layout(
      `<p>Hello ${escapeHtml(r.first_name)},</p>` +
      `<p>${escapeHtml(shift.manager_name)} has handed over the <strong>${escapeHtml(title)}</strong> ` +
      `(${escapeHtml(when)}, ${shift.staff_count} staff).</p>` +
      htmlSection(`Open tasks (${tasks.length})`, tasks, taskLine, 'None') +
      htmlSection(`Incidents (${incidents.length})`, incidents, incidentLine, 'None logged') +
      '<h3 style="font-size:15px;margin:18px 0 6px">Handover notes</h3>' +
      `<p style="white-space:pre-wrap;margin:0">${escapeHtml(shift.notes || 'No notes')}</p>` +
      button(link, 'Open the shift')
    ),
  }));
}

module.exports = {
  appUrl, formatTime, escapeHtml, layout, button, sendToEach, emailHighRisk, emailHandoverSummary,
};
