const pool = require('../config/db');
const { LATEST_PREDICTION } = require('./incidentController');
const { SHIFT_TYPES, toShiftType } = require('../utils/labels');
const { parseId, isTimestamp, invalid } = require('../utils/request');

const RISK_LEVELS = ['Low', 'Medium', 'High'];
const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;
const LIST_LIMIT = 200;

// Incidents from the start of the first day in the window up to the end of today
// (database time zone). $1 is the number of days.
const IN_WINDOW = `i.occurred_at >= CURRENT_DATE - ($1::int - 1) AND i.occurred_at < CURRENT_DATE + 1`;

// Unfinished tasks on shifts from the first day in the window onwards. $1 is the number of days.
const OPEN_TASK_IN_WINDOW = `t.status <> 'Complete' AND s.shift_date >= CURRENT_DATE - ($1::int - 1)`;

const INCIDENT_JOINS = `
  FROM incidents i
  JOIN shifts s ON s.shift_id = i.shift_id
  JOIN departments d ON d.department_id = s.department_id
  ${LATEST_PREDICTION}`;

// Returns the window length in days, or null when the query value is invalid.
function readDays(value) {
  const days = value === undefined ? DEFAULT_DAYS : Number(value);
  return Number.isInteger(days) && days >= 1 && days <= MAX_DAYS ? days : null;
}

const DAYS_ERROR = { days: `days must be a whole number from 1 to ${MAX_DAYS}` };

function emptyCounts() {
  return { Low: 0, Medium: 0, High: 0, not_predicted: 0, total: 0 };
}

// Adds a grouped row ({ risk_level, count }) to the counts kept under `key`.
function addTo(map, key, row, extra = {}) {
  if (!map.has(key)) map.set(key, { ...extra, ...emptyCounts() });
  const counts = map.get(key);
  counts[row.risk_level || 'not_predicted'] += row.count;
  counts.total += row.count;
}

// 'YYYY-MM-DD' for each of the `days` days ending on `today`, oldest first.
function dayRange(today, days) {
  const end = new Date(`${today}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - (days - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

// Counts for the dashboard charts. Each incident is counted once, by its latest prediction.
async function getSummary(req, res, next) {
  const days = readDays(req.query.days);
  if (!days) return invalid(res, DAYS_ERROR);

  try {
    const [grouped, recentHigh, extra] = await Promise.all([
      pool.query(
        `SELECT i.occurred_at::date AS day, d.department_id, d.name AS department_name, s.shift_type,
                p.risk_level, COUNT(*)::int AS count
           ${INCIDENT_JOINS}
          WHERE ${IN_WINDOW}
          GROUP BY 1, 2, 3, 4, 5`,
        [days]
      ),
      pool.query(
        `SELECT i.incident_id, i.incident_type, i.occurred_at, s.shift_id, s.shift_type,
                d.name AS department_name, p.confidence
           ${INCIDENT_JOINS}
          WHERE ${IN_WINDOW} AND p.risk_level = 'High'
          ORDER BY i.occurred_at DESC
          LIMIT 5`,
        [days]
      ),
      pool.query(
        `SELECT CURRENT_DATE AS today,
                (SELECT COUNT(*)::int
                   FROM tasks t
                   JOIN shifts s ON s.shift_id = t.shift_id
                  WHERE ${OPEN_TASK_IN_WINDOW}) AS open_tasks`,
        [days]
      ),
    ]);

    const { today, open_tasks } = extra.rows[0];
    const total = emptyCounts();
    const byDepartment = new Map();
    const byShiftType = new Map(SHIFT_TYPES.map((t) => [t, emptyCounts()]));
    const byDay = new Map(dayRange(today, days).map((d) => [d, emptyCounts()]));

    for (const row of grouped.rows) {
      total[row.risk_level || 'not_predicted'] += row.count;
      total.total += row.count;
      addTo(byDepartment, row.department_id, row, {
        department_id: row.department_id,
        department: row.department_name,
      });
      addTo(byShiftType, row.shift_type, row);
      if (byDay.has(row.day)) addTo(byDay, row.day, row);
    }

    res.json({
      days,
      from: byDay.keys().next().value,
      to: today,
      totals: {
        incidents: total.total,
        Low: total.Low,
        Medium: total.Medium,
        High: total.High,
        not_predicted: total.not_predicted,
        open_tasks,
      },
      by_risk: RISK_LEVELS.map((level) => ({ risk_level: level, count: total[level] })),
      by_department: [...byDepartment.values()]
        .sort((a, b) => b.total - a.total || a.department.localeCompare(b.department)),
      by_shift_type: [...byShiftType].map(([shift_type, counts]) => ({ shift_type, ...counts })),
      by_day: [...byDay].map(([day, counts]) => ({ day, ...counts })),
      recent_high: recentHigh.rows,
    });
  } catch (err) {
    next(err);
  }
}

// The incidents behind a dashboard count, in the same window as the summary.
// risk_level=none lists incidents without a prediction.
async function listIncidents(req, res, next) {
  const days = readDays(req.query.days);
  const { risk_level, shift_type, department_id, day } = req.query;
  const errors = days ? {} : { ...DAYS_ERROR };

  if (risk_level !== undefined && ![...RISK_LEVELS, 'none'].includes(risk_level)) {
    errors.risk_level = `risk_level must be one of ${RISK_LEVELS.join(', ')}, none`;
  }
  const shiftType = shift_type === undefined ? null : toShiftType(shift_type);
  if (shift_type !== undefined && !shiftType) errors.shift_type = `shift_type must be one of ${SHIFT_TYPES.join(', ')}`;
  const departmentId = department_id === undefined ? null : parseId(department_id);
  if (department_id !== undefined && !departmentId) errors.department_id = 'department_id must be a positive integer';
  // Round trip so impossible dates such as 2026-02-30 are rejected too.
  if (day !== undefined && !(isTimestamp(day) && new Date(day).toISOString().slice(0, 10) === day)) {
    errors.day = 'day must be a date (YYYY-MM-DD)';
  }
  if (Object.keys(errors).length > 0) return invalid(res, errors);

  try {
    const { rows } = await pool.query(
      `SELECT i.incident_id, i.incident_type, i.occurred_at, i.task_status, s.shift_id, s.shift_type,
              s.shift_date, d.name AS department_name, p.risk_level, p.confidence
         ${INCIDENT_JOINS}
        WHERE ${IN_WINDOW}
          AND ($2::text IS NULL OR ($2::text = 'none' AND p.risk_level IS NULL) OR p.risk_level::text = $2::text)
          AND ($3::shift_type IS NULL OR s.shift_type = $3::shift_type)
          AND ($4::int IS NULL OR s.department_id = $4::int)
          AND ($5::date IS NULL OR i.occurred_at::date = $5::date)
        ORDER BY i.occurred_at DESC
        LIMIT ${LIST_LIMIT}`,
      [days, risk_level ?? null, shiftType, departmentId, day ?? null]
    );
    res.json({ incidents: rows });
  } catch (err) {
    next(err);
  }
}

// The open tasks behind the dashboard count, newest shift first.
async function listOpenTasks(req, res, next) {
  const days = readDays(req.query.days);
  if (!days) return invalid(res, DAYS_ERROR);

  try {
    const { rows } = await pool.query(
      `SELECT t.task_id, t.title, t.aircraft_reg, t.status, s.shift_id, s.shift_type, s.shift_date,
              d.name AS department_name
         FROM tasks t
         JOIN shifts s ON s.shift_id = t.shift_id
         JOIN departments d ON d.department_id = s.department_id
        WHERE ${OPEN_TASK_IN_WINDOW}
        ORDER BY s.shift_date DESC, s.start_time DESC, t.task_id
        LIMIT ${LIST_LIMIT}`,
      [days]
    );
    res.json({ tasks: rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSummary, listIncidents, listOpenTasks };
