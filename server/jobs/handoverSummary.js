const pool = require('../config/db');
const { emailHandoverSummary } = require('../services/alerts');

// #38: when a shift ends, email its open tasks, incidents and notes to the next manager on duty
// in the same department. If no next shift is scheduled yet, the department's other managers get it.
// Only shifts that ended in the last 24 hours are picked up, so old shifts are never backfilled.
async function run() {
  const { rows: shifts } = await pool.query(
    `UPDATE shifts s SET handover_sent_at = NOW()
       FROM shift_managers m, departments d
      WHERE m.manager_id = s.manager_id AND d.department_id = s.department_id
        AND s.handover_sent_at IS NULL
        AND s.end_time <= NOW() AND s.end_time > NOW() - INTERVAL '24 hours'
      RETURNING s.shift_id, s.manager_id, s.department_id, s.shift_type, s.start_time, s.end_time,
                s.staff_count, s.notes, m.first_name || ' ' || m.last_name AS manager_name,
                d.name AS department_name`
  );

  let sent = 0;
  for (const shift of shifts) {
    let { rows: recipients } = await pool.query(
      `SELECT m.email, m.first_name
         FROM shifts n JOIN shift_managers m ON m.manager_id = n.manager_id
        WHERE n.department_id = $1 AND n.shift_id <> $2 AND m.is_active
          AND n.start_time > $3 AND n.start_time <= $4::timestamptz + INTERVAL '12 hours'
        ORDER BY n.start_time
        LIMIT 1`,
      [shift.department_id, shift.shift_id, shift.start_time, shift.end_time]
    );
    if (recipients.length === 0) {
      ({ rows: recipients } = await pool.query(
        `SELECT email, first_name FROM shift_managers
          WHERE is_active AND department_id = $1 AND manager_id <> $2`,
        [shift.department_id, shift.manager_id]
      ));
    }
    if (recipients.length === 0) continue;

    const [tasks, incidents] = await Promise.all([
      pool.query(
        `SELECT task_id, title, aircraft_reg, status FROM tasks
          WHERE shift_id = $1 AND status <> 'Complete' ORDER BY created_at`,
        [shift.shift_id]
      ),
      pool.query(
        `SELECT i.incident_id, i.incident_type, i.occurred_at, p.risk_level
           FROM incidents i
           LEFT JOIN LATERAL (
             SELECT risk_level FROM incident_predictions
              WHERE incident_id = i.incident_id
              ORDER BY created_at DESC, prediction_id DESC LIMIT 1
           ) p ON TRUE
          WHERE i.shift_id = $1 ORDER BY i.occurred_at`,
        [shift.shift_id]
      ),
    ]);

    const result = await emailHandoverSummary({
      shift, tasks: tasks.rows, incidents: incidents.rows, recipients,
    });
    sent += result.sent;
  }
  return { shifts: shifts.length, sent };
}

module.exports = { run };
