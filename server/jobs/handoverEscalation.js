const pool = require('../config/db');
const { emailHandoverEscalation } = require('../services/alerts');
const { settings } = require('./alertEscalation');

// Module 2: a submitted handover whose High risk incident items are still unticked
// ESCALATION_MINUTES after it was submitted is emailed to ESCALATION_EMAIL, once.
// Same settings and claim-then-send pattern as the alert escalation job (#40).
async function run() {
  const { minutes, recipients } = settings();
  if (recipients.length === 0) return { handovers: 0, sent: 0 }; // escalation not configured

  // Claims the handovers (escalated_at) and returns each with its unticked High items.
  const { rows: handovers } = await pool.query(
    `WITH unticked AS (
       SELECT hi.handover_id, i.incident_id, i.incident_type, i.occurred_at
         FROM handover_items hi
         JOIN incidents i ON i.incident_id = hi.incident_id
         JOIN LATERAL (
           SELECT final_risk_level FROM incident_predictions
            WHERE incident_id = hi.incident_id
            ORDER BY created_at DESC, prediction_id DESC LIMIT 1
         ) p ON TRUE
        WHERE hi.item_type = 'Incident' AND hi.acknowledged_at IS NULL AND p.final_risk_level = 'High'
     ), claimed AS (
       UPDATE handovers SET escalated_at = NOW()
        WHERE status = 'Submitted' AND escalated_at IS NULL
          AND submitted_at <= NOW() - make_interval(mins => $1)
          AND submitted_at > NOW() - INTERVAL '24 hours'
          AND handover_id IN (SELECT handover_id FROM unticked)
        RETURNING *
     )
     SELECT c.handover_id, c.shift_id, c.submitted_at, s.shift_type, s.shift_date,
            d.name AS department_name,
            f.first_name || ' ' || f.last_name AS from_manager_name,
            t.first_name || ' ' || t.last_name AS to_manager_name,
            (SELECT json_agg(json_build_object('incident_id', u.incident_id, 'incident_type', u.incident_type,
                                               'occurred_at', u.occurred_at) ORDER BY u.occurred_at)
               FROM unticked u WHERE u.handover_id = c.handover_id) AS high_items
       FROM claimed c
       JOIN shifts s ON s.shift_id = c.shift_id
       JOIN departments d ON d.department_id = s.department_id
       JOIN shift_managers f ON f.manager_id = c.from_manager_id
       LEFT JOIN shift_managers t ON t.manager_id = c.to_manager_id`,
    [minutes]
  );

  let sent = 0;
  for (const handover of handovers) {
    const result = await emailHandoverEscalation({ handover, minutes, recipients });
    sent += result.sent;
  }
  return { handovers: handovers.length, sent };
}

module.exports = { run };
