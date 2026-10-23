const pool = require('../config/db');
const { SHIFT_TYPES, toShiftType } = require('../utils/labels');
const { parseId, isTimestamp, buildSet, invalid } = require('../utils/request');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const SHIFT_SELECT = `
  SELECT s.*,
         m.first_name || ' ' || m.last_name AS manager_name,
         d.name AS department_name,
         (SELECT COUNT(*)::int FROM tasks t WHERE t.shift_id = s.shift_id) AS task_count,
         (SELECT COUNT(*)::int FROM tasks t
           WHERE t.shift_id = s.shift_id AND t.status <> 'Complete') AS open_task_count
    FROM shifts s
    JOIN shift_managers m ON m.manager_id = s.manager_id
    JOIN departments d ON d.department_id = s.department_id`;

function isStaffCount(value) {
  return Number.isInteger(value) && value >= 0;
}

// Returns the shift's owner row, or sends 404/403 and returns null.
async function findOwnedShift(req, res) {
  const shiftId = parseId(req.params.id);
  const { rows } = shiftId
    ? await pool.query('SELECT shift_id, manager_id FROM shifts WHERE shift_id = $1', [shiftId])
    : { rows: [] };
  if (!rows[0]) {
    res.status(404).json({ message: 'Shift not found' });
    return null;
  }
  if (rows[0].manager_id !== req.user.manager_id) {
    res.status(403).json({ message: 'Only the manager who owns this shift can change it' });
    return null;
  }
  return rows[0];
}

function handleDbError(err, res, next) {
  if (err.code === '23514') {
    return invalid(res, { end_time: 'end_time must be after start_time' });
  }
  if (err.code === '23503') {
    return invalid(res, { department_id: 'Department not found' });
  }
  next(err);
}

async function listShifts(req, res, next) {
  const { date, department_id } = req.query;
  if (date !== undefined && !DATE_RE.test(date)) {
    return invalid(res, { date: 'date must be YYYY-MM-DD' });
  }
  const departmentId = department_id === undefined ? null : parseId(department_id);
  if (department_id !== undefined && departmentId === null) {
    return invalid(res, { department_id: 'department_id must be a positive integer' });
  }

  try {
    const { rows } = await pool.query(
      `${SHIFT_SELECT}
        WHERE ($1::date IS NULL OR s.shift_date = $1::date)
          AND ($2::int IS NULL OR s.department_id = $2::int)
        ORDER BY s.start_time DESC
        LIMIT 100`,
      [date ?? null, departmentId]
    );
    res.json({ shifts: rows });
  } catch (err) {
    next(err);
  }
}

async function createShift(req, res, next) {
  const { shift_type, shift_date, start_time, end_time, staff_count = 0, notes = null } = req.body || {};
  const departmentId = req.body?.department_id ?? req.user.department_id;

  const errors = {};
  const shiftType = toShiftType(shift_type);
  if (!shiftType) errors.shift_type = `shift_type must be one of ${SHIFT_TYPES.join(', ')}`;
  if (typeof shift_date !== 'string' || !DATE_RE.test(shift_date)) {
    errors.shift_date = 'shift_date must be YYYY-MM-DD';
  }
  if (!isTimestamp(start_time)) errors.start_time = 'start_time must be an ISO date-time';
  if (!isTimestamp(end_time)) errors.end_time = 'end_time must be an ISO date-time';
  if (!errors.start_time && !errors.end_time && Date.parse(end_time) <= Date.parse(start_time)) {
    errors.end_time = 'end_time must be after start_time';
  }
  if (!isStaffCount(staff_count)) errors.staff_count = 'staff_count must be a whole number >= 0';
  if (!Number.isInteger(departmentId)) {
    errors.department_id = 'department_id is required (your account has no department)';
  }
  if (Object.keys(errors).length > 0) return invalid(res, errors);

  try {
    const { rows } = await pool.query(
      `INSERT INTO shifts (manager_id, department_id, shift_type, shift_date, start_time, end_time, staff_count, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.user.manager_id, departmentId, shiftType, shift_date, start_time, end_time, staff_count, notes]
    );
    res.status(201).json({ shift: rows[0] });
  } catch (err) {
    handleDbError(err, res, next);
  }
}

// Handover view: the shift with its tasks and incidents (latest prediction each).
async function getShift(req, res, next) {
  const shiftId = parseId(req.params.id);
  if (!shiftId) return res.status(404).json({ message: 'Shift not found' });

  try {
    const shiftResult = await pool.query(`${SHIFT_SELECT} WHERE s.shift_id = $1`, [shiftId]);
    if (!shiftResult.rows[0]) return res.status(404).json({ message: 'Shift not found' });

    const tasksResult = await pool.query(
      'SELECT * FROM tasks WHERE shift_id = $1 ORDER BY created_at, task_id',
      [shiftId]
    );
    const incidentsResult = await pool.query(
      `SELECT i.*,
              p.prediction_id, p.risk_level, p.confidence, p.top_factors
         FROM incidents i
         LEFT JOIN LATERAL (
           SELECT prediction_id, risk_level, confidence, top_factors
             FROM incident_predictions
            WHERE incident_id = i.incident_id
            ORDER BY created_at DESC
            LIMIT 1
         ) p ON TRUE
        WHERE i.shift_id = $1
        ORDER BY i.occurred_at DESC`,
      [shiftId]
    );

    res.json({
      shift: shiftResult.rows[0],
      tasks: tasksResult.rows,
      incidents: incidentsResult.rows,
    });
  } catch (err) {
    next(err);
  }
}

async function updateShift(req, res, next) {
  const body = req.body || {};
  const updates = {};
  const errors = {};

  if ('notes' in body) {
    if (body.notes !== null && typeof body.notes !== 'string') errors.notes = 'notes must be text';
    else updates.notes = body.notes;
  }
  if ('staff_count' in body) {
    if (!isStaffCount(body.staff_count)) errors.staff_count = 'staff_count must be a whole number >= 0';
    else updates.staff_count = body.staff_count;
  }
  if ('end_time' in body) {
    if (!isTimestamp(body.end_time)) errors.end_time = 'end_time must be an ISO date-time';
    else updates.end_time = body.end_time;
  }
  if (Object.keys(errors).length > 0) return invalid(res, errors);
  if (Object.keys(updates).length === 0) {
    return invalid(res, { body: 'Send at least one of notes, staff_count, end_time' });
  }

  try {
    const shift = await findOwnedShift(req, res);
    if (!shift) return;

    const { clause, values } = buildSet(updates);
    const { rows } = await pool.query(
      `UPDATE shifts SET ${clause} WHERE shift_id = $${values.length + 1} RETURNING *`,
      [...values, shift.shift_id]
    );
    res.json({ shift: rows[0] });
  } catch (err) {
    handleDbError(err, res, next);
  }
}

module.exports = { listShifts, createShift, getShift, updateShift, findOwnedShift };
