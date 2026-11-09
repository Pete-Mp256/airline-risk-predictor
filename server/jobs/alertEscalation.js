const pool = require('../config/db');
const { emailEscalation } = require('../services/alerts');

// #40: if nobody has read a High risk alert within ESCALATION_MINUTES, email the supervisor
// address(es) in ESCALATION_EMAIL. A prediction notifies several managers; it is escalated
// only when none of them has read it. Each prediction is escalated once.
function settings() {
  const minutes = Number(process.env.ESCALATION_MINUTES);
  return {
    minutes: Number.isInteger(minutes) && minutes > 0 ? minutes : 30,
    recipients: (process.env.ESCALATION_EMAIL || '')
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean)
      .map((email) => ({ email })),
  };
}

async function run() {
  const { minutes, recipients } = settings();
  if (recipients.length === 0) return { predictions: 0, sent: 0 }; // escalation not configured

  const { rows: claimed } = await pool.query(
    `UPDATE notifications SET escalated_at = NOW()
      WHERE prediction_id IN (
        SELECT prediction_id FROM notifications
         WHERE prediction_id IS NOT NULL
         GROUP BY prediction_id
        HAVING BOOL_AND(NOT is_read) AND BOOL_AND(escalated_at IS NULL)
           AND MIN(created_at) <= NOW() - make_interval(mins => $1)
           AND MIN(created_at) > NOW() - INTERVAL '24 hours'
      )
      RETURNING prediction_id`,
    [minutes]
  );
  const predictionIds = [...new Set(claimed.map((r) => r.prediction_id))];
  if (predictionIds.length === 0) return { predictions: 0, sent: 0 };

  const { rows: alerts } = await pool.query(
    `SELECT p.prediction_id, p.confidence, p.top_factors, p.created_at,
            i.incident_id, i.incident_type, s.shift_id, s.shift_type,
            d.name AS department_name, m.first_name || ' ' || m.last_name AS manager_name,
            (SELECT COUNT(*)::int FROM notifications n WHERE n.prediction_id = p.prediction_id) AS notified
       FROM incident_predictions p
       JOIN incidents i ON i.incident_id = p.incident_id
       JOIN shifts s ON s.shift_id = i.shift_id
       JOIN departments d ON d.department_id = s.department_id
       JOIN shift_managers m ON m.manager_id = s.manager_id
      WHERE p.prediction_id = ANY($1)`,
    [predictionIds]
  );

  let sent = 0;
  for (const alert of alerts) {
    const result = await emailEscalation({ alert, minutes, recipients });
    sent += result.sent;
  }
  return { predictions: predictionIds.length, sent };
}

module.exports = { run };
