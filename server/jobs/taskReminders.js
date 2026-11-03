const pool = require('../config/db');
const { emailTaskReminder, formatTime } = require('../services/alerts');

// #39: shortly before a shift ends, remind its manager (email + in-app notification) about tasks
// that are still Pending or In Progress. Each task is reminded once.
function leadMinutes() {
  const value = Number(process.env.REMINDER_LEAD_MINUTES);
  return Number.isInteger(value) && value > 0 ? value : 60;
}

async function run() {
  const { rows: tasks } = await pool.query(
    `UPDATE tasks t SET reminder_sent_at = NOW()
       FROM shifts s
      WHERE s.shift_id = t.shift_id
        AND t.reminder_sent_at IS NULL AND t.status <> 'Complete'
        AND s.end_time > NOW() AND s.end_time <= NOW() + make_interval(mins => $1)
      RETURNING t.task_id, t.title, t.aircraft_reg, t.status,
                s.shift_id, s.manager_id, s.shift_type, s.end_time`,
    [leadMinutes()]
  );

  // One reminder per shift, listing all of its open tasks.
  const byShift = new Map();
  for (const task of tasks) {
    if (!byShift.has(task.shift_id)) byShift.set(task.shift_id, []);
    byShift.get(task.shift_id).push(task);
  }

  let sent = 0;
  for (const [shiftId, shiftTasks] of byShift) {
    const shift = shiftTasks[0];
    const { rows } = await pool.query(
      'SELECT email, first_name FROM shift_managers WHERE manager_id = $1 AND is_active',
      [shift.manager_id]
    );
    if (rows.length === 0) continue;

    const count = shiftTasks.length;
    await pool.query(
      'INSERT INTO notifications (manager_id, shift_id, message) VALUES ($1, $2, $3)',
      [
        shift.manager_id,
        shiftId,
        `${count} task${count === 1 ? '' : 's'} still open on your ${shift.shift_type} shift, ` +
          `which ends at ${formatTime(shift.end_time)}.`,
      ]
    );
    const result = await emailTaskReminder({ shift, tasks: shiftTasks, recipients: rows });
    sent += result.sent;
  }
  return { tasks: tasks.length, sent };
}

module.exports = { run };
