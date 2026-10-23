const pool = require('../config/db');
const { TASK_STATUSES, toTaskStatus } = require('../utils/labels');
const { parseId, isBlank, buildSet, invalid } = require('../utils/request');
const { findOwnedShift } = require('./shiftController');

const OPTIONAL_TEXT = { description: null, aircraft_reg: 20, task_type: 50 }; // column: max length

// Validates the task fields present in `body`. With `partial` false, title is required.
function readTaskFields(body, partial) {
  const fields = {};
  const errors = {};

  if (!partial || 'title' in body) {
    if (isBlank(body.title) || body.title.trim().length > 150) {
      errors.title = 'title is required (max 150 characters)';
    } else {
      fields.title = body.title.trim();
    }
  }
  for (const [col, maxLength] of Object.entries(OPTIONAL_TEXT)) {
    if (!(col in body)) continue;
    const value = body[col];
    if (value !== null && typeof value !== 'string') errors[col] = `${col} must be text`;
    else if (maxLength && value && value.length > maxLength) errors[col] = `${col} max ${maxLength} characters`;
    else fields[col] = value;
  }
  if ('complexity' in body) {
    const value = body.complexity;
    if (value !== null && !(Number.isInteger(value) && value >= 1 && value <= 5)) {
      errors.complexity = 'complexity must be a whole number from 1 to 5';
    } else fields.complexity = value;
  }
  if ('estimated_hours' in body) {
    const value = body.estimated_hours;
    if (value !== null && !(typeof value === 'number' && value >= 0 && value < 1000)) {
      errors.estimated_hours = 'estimated_hours must be a number from 0 to 999';
    } else fields.estimated_hours = value;
  }
  if ('status' in body) {
    const status = toTaskStatus(body.status);
    if (!status) errors.status = `status must be one of ${TASK_STATUSES.join(', ')}`;
    else fields.status = status;
  }

  return { fields, errors };
}

async function createTask(req, res, next) {
  const { fields, errors } = readTaskFields(req.body || {}, false);
  if (Object.keys(errors).length > 0) return invalid(res, errors);

  try {
    const shift = await findOwnedShift(req, res);
    if (!shift) return;

    const columns = ['shift_id', ...Object.keys(fields)];
    const values = [shift.shift_id, ...Object.values(fields)];
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `INSERT INTO tasks (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    res.status(201).json({ task: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function updateTask(req, res, next) {
  const taskId = parseId(req.params.id);
  if (!taskId) return res.status(404).json({ message: 'Task not found' });

  const { fields, errors } = readTaskFields(req.body || {}, true);
  if (Object.keys(errors).length > 0) return invalid(res, errors);
  if (Object.keys(fields).length === 0) {
    return invalid(res, { body: 'Send at least one task field to update' });
  }

  try {
    const owner = await pool.query(
      `SELECT s.manager_id FROM tasks t JOIN shifts s ON s.shift_id = t.shift_id WHERE t.task_id = $1`,
      [taskId]
    );
    if (!owner.rows[0]) return res.status(404).json({ message: 'Task not found' });
    if (owner.rows[0].manager_id !== req.user.manager_id) {
      return res.status(403).json({ message: 'Only the manager who owns this shift can change its tasks' });
    }

    const { clause, values } = buildSet(fields);
    const { rows } = await pool.query(
      `UPDATE tasks SET ${clause} WHERE task_id = $${values.length + 1} RETURNING *`,
      [...values, taskId]
    );
    res.json({ task: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { createTask, updateTask };
