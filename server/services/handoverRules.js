const pool = require('../config/db');

// Module 2: handover rule layer. Checks the handover the incoming team received (the previous
// shift in the same department) and can raise the model's rating. It never lowers one.
// All thresholds are here so they can be cited in the report.
const RULES = {
  MIN_FLAGS_FOR_WEAK: 2,       // this many flags or more makes the handover Weak
  OPEN_TASKS: 3,               // previous handover carried over this many open tasks or more
  MIN_SUMMARY_CHARS: 20,       // previous summary missing or shorter than this
  LATE_ACK_MINUTES: 30,        // previous handover acknowledged this long after shift start, or not at all
  EDGE_OF_SHIFT_MINUTES: 60,   // incident within this many minutes of shift start or end
  OPEN_TASKS_PER_STAFF: 2,     // open tasks per staff member above this (skipped when staff_count is 0)
};

const FLAGS = {
  carried_over_task: 'Incident is on a task carried over from the previous shift',
  many_open_tasks: `Previous handover had ${RULES.OPEN_TASKS} or more open tasks`,
  weak_summary: `Previous handover summary missing or under ${RULES.MIN_SUMMARY_CHARS} characters`,
  late_acknowledgement: `Previous handover not acknowledged, or acknowledged ${RULES.LATE_ACK_MINUTES}+ min after shift start`,
  previous_high_incident: 'Previous handover had a High risk incident',
  edge_of_shift: `Incident within ${RULES.EDGE_OF_SHIFT_MINUTES} min of shift start or end`,
  high_workload: `More than ${RULES.OPEN_TASKS_PER_STAFF} open tasks per staff member`,
};

const minutesBetween = (a, b) => (new Date(b) - new Date(a)) / 60000;

// The most recent earlier shift in the same department as shift $1, with its handover if it
// was submitted (a Draft was never received). No row when there is no earlier shift.
const PREVIOUS_HANDOVER = `
  SELECT ps.shift_id AS previous_shift_id, h.handover_id, h.summary, h.acknowledged_at
    FROM shifts cur
    JOIN shifts ps ON ps.department_id = cur.department_id
                  AND ps.start_time < cur.start_time AND ps.shift_id <> cur.shift_id
    LEFT JOIN handovers h ON h.shift_id = ps.shift_id AND h.status <> 'Draft'
   WHERE cur.shift_id = $1
   ORDER BY ps.start_time DESC, ps.shift_id DESC
   LIMIT 1`;

// Task ids carried over to shift $1 by the previous handover.
const CARRIED_TASK_IDS = `
  SELECT hi.task_id
    FROM handover_items hi
   WHERE hi.carried_over AND hi.task_id IS NOT NULL
     AND hi.handover_id = (SELECT handover_id FROM (${PREVIOUS_HANDOVER}) prev)`;

// Pure check. context:
//   incident: { task_id, occurred_at }
//   shift: { start_time, end_time, staff_count, open_tasks }
//   previous: null (no earlier shift) or
//     { handover: null | { summary, acknowledged_at }, open_tasks, carried_task_ids, had_high_incident }
// Returns { flags: [{ code, label }], level: 'OK' | 'Weak' }.
function evaluate({ incident, shift, previous }) {
  const fired = [];
  if (previous) {
    const { handover } = previous;
    if (incident.task_id != null && previous.carried_task_ids.includes(incident.task_id)) {
      fired.push('carried_over_task');
    }
    if (previous.open_tasks >= RULES.OPEN_TASKS) fired.push('many_open_tasks');
    if (!handover || (handover.summary || '').trim().length < RULES.MIN_SUMMARY_CHARS) {
      fired.push('weak_summary');
    }
    if (!handover || !handover.acknowledged_at ||
        minutesBetween(shift.start_time, handover.acknowledged_at) >= RULES.LATE_ACK_MINUTES) {
      fired.push('late_acknowledgement');
    }
    if (previous.had_high_incident) fired.push('previous_high_incident');
  }
  if (Math.abs(minutesBetween(shift.start_time, incident.occurred_at)) <= RULES.EDGE_OF_SHIFT_MINUTES ||
      Math.abs(minutesBetween(incident.occurred_at, shift.end_time)) <= RULES.EDGE_OF_SHIFT_MINUTES) {
    fired.push('edge_of_shift');
  }
  if (shift.staff_count > 0 && shift.open_tasks / shift.staff_count > RULES.OPEN_TASKS_PER_STAFF) {
    fired.push('high_workload');
  }

  return {
    flags: fired.map((code) => ({ code, label: FLAGS[code] })),
    level: fired.length >= RULES.MIN_FLAGS_FOR_WEAK ? 'Weak' : 'OK',
  };
}

// Final rating: a Weak handover raises Medium to High. Low and High are never changed.
function applyRules(modelLevel, handoverLevel) {
  return handoverLevel === 'Weak' && modelLevel === 'Medium' ? 'High' : modelLevel;
}

// Loads the facts evaluate() needs for an incident on its shift.
async function loadContext(incident) {
  const shiftId = incident.shift_id;
  const [shiftResult, previousResult] = await Promise.all([
    pool.query(
      `SELECT s.start_time, s.end_time, s.staff_count,
              (SELECT COUNT(*)::int FROM tasks t
                WHERE t.status <> 'Complete'
                  AND (t.shift_id = s.shift_id OR t.task_id IN (${CARRIED_TASK_IDS}))) AS open_tasks
         FROM shifts s WHERE s.shift_id = $1`,
      [shiftId]
    ),
    pool.query(PREVIOUS_HANDOVER, [shiftId]),
  ]);

  const prev = previousResult.rows[0];
  let previous = null;
  if (prev) {
    // With a handover, use what it carried; without one, use the previous shift itself.
    const { rows } = await pool.query(
      `SELECT
         COALESCE(ARRAY(SELECT hi.task_id FROM handover_items hi
                         WHERE hi.handover_id = $2 AND hi.carried_over AND hi.task_id IS NOT NULL), '{}') AS carried_task_ids,
         CASE WHEN $2::int IS NULL
              THEN (SELECT COUNT(*)::int FROM tasks WHERE shift_id = $1 AND status <> 'Complete')
              ELSE (SELECT COUNT(*)::int FROM handover_items WHERE handover_id = $2 AND item_type = 'Open task')
         END AS open_tasks,
         EXISTS (
           SELECT 1 FROM incidents i
             JOIN LATERAL (
               SELECT final_risk_level FROM incident_predictions
                WHERE incident_id = i.incident_id
                ORDER BY created_at DESC, prediction_id DESC LIMIT 1
             ) p ON TRUE
            WHERE p.final_risk_level = 'High'
              AND CASE WHEN $2::int IS NULL THEN i.shift_id = $1
                       ELSE i.incident_id IN (SELECT incident_id FROM handover_items WHERE handover_id = $2)
                  END
         ) AS had_high_incident`,
      [prev.previous_shift_id, prev.handover_id]
    );
    previous = {
      handover: prev.handover_id ? { summary: prev.summary, acknowledged_at: prev.acknowledged_at } : null,
      ...rows[0],
    };
  }

  return { incident, shift: shiftResult.rows[0], previous };
}

// Runs the rules for an incident and gives the columns stored on the prediction.
async function checkHandover(incident, modelLevel) {
  const { flags, level } = evaluate(await loadContext(incident));
  return { handover_flags: flags, handover_level: level, final_risk_level: applyRules(modelLevel, level) };
}

module.exports = {
  RULES, FLAGS, PREVIOUS_HANDOVER, CARRIED_TASK_IDS, evaluate, applyRules, loadContext, checkHandover,
};
