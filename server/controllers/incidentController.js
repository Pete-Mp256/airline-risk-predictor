const pool = require('../config/db');
const mlClient = require('../services/mlClient');
const { TASK_STATUSES, toTaskStatus } = require('../utils/labels');
const { parseId, isBlank, isTimestamp, invalid } = require('../utils/request');

const RISK_LEVELS = ['Low', 'Medium', 'High'];

// Numeric model features: [column, integer?, min, max]. Ranges follow database/schema.sql.
const NUMERIC_FEATURES = [
  ['severity_score', false, 0, 1],
  ['tool_wear_min', true, 0, 100000],
  ['air_temp_k', false, 0.01, 9999],
  ['process_temp_k', false, 0.01, 9999],
  ['rotational_speed', true, 1, 1000000],
  ['resolution_time', true, 0, 1000000],
];

const LATEST_PREDICTION = `
  LEFT JOIN LATERAL (
    SELECT prediction_id, risk_level, confidence, probabilities, top_factors
      FROM incident_predictions
     WHERE incident_id = i.incident_id
     ORDER BY created_at DESC, prediction_id DESC
     LIMIT 1
  ) p ON TRUE`;

function readIncident(body) {
  const fields = {};
  const errors = {};

  const shiftId = parseId(body.shift_id);
  if (!shiftId) errors.shift_id = 'shift_id is required';
  if (body.task_id != null) {
    fields.task_id = parseId(body.task_id);
    if (!fields.task_id) errors.task_id = 'task_id must be a positive integer';
  }
  if (isBlank(body.incident_type) || body.incident_type.trim().length > 50) {
    errors.incident_type = 'incident_type is required (max 50 characters)';
  } else fields.incident_type = body.incident_type.trim();
  if (isBlank(body.description)) errors.description = 'description is required';
  else fields.description = body.description.trim();
  if (body.reported_severity != null) {
    if (!RISK_LEVELS.includes(body.reported_severity)) {
      errors.reported_severity = `reported_severity must be one of ${RISK_LEVELS.join(', ')}`;
    } else fields.reported_severity = body.reported_severity;
  }
  if (!isTimestamp(body.occurred_at)) errors.occurred_at = 'occurred_at must be an ISO date-time';
  else fields.occurred_at = body.occurred_at;
  if (body.task_status != null) {
    fields.task_status = toTaskStatus(body.task_status);
    if (!fields.task_status) errors.task_status = `task_status must be one of ${TASK_STATUSES.join(', ')}`;
  }
  for (const [col, integer, min, max] of NUMERIC_FEATURES) {
    const value = body[col];
    const ok = typeof value === 'number' && Number.isFinite(value) &&
      (!integer || Number.isInteger(value)) && value >= min && value <= max;
    if (!ok) errors[col] = `${col} must be a ${integer ? 'whole number' : 'number'} from ${min} to ${max}`;
    else fields[col] = value;
  }

  return { shiftId, fields, errors };
}

// Builds the 8 model inputs (model_meta.json features) from an incident row and its shift type.
function modelFeatures(incident, shiftType) {
  const features = { shift_type: shiftType, task_status: incident.task_status };
  for (const [col] of NUMERIC_FEATURES) features[col] = Number(incident[col]);
  return features;
}

// Calls Flask, stores the prediction and notifies on High risk.
// Returns { prediction } or { prediction: null, error } when the ML service fails.
async function runPrediction(incident, shift) {
  let response;
  try {
    response = await mlClient.predict(modelFeatures(incident, shift.shift_type));
  } catch (err) {
    if (err instanceof mlClient.MlServiceError) return { prediction: null, error: err.message };
    throw err;
  }

  const { result, responseMs } = response;
  const { rows } = await pool.query(
    `INSERT INTO incident_predictions
       (incident_id, risk_level, confidence, probabilities, top_factors, high_threshold, model_version, response_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      incident.incident_id,
      result.risk_level,
      result.confidence,
      JSON.stringify(result.probabilities),
      JSON.stringify(result.top_factors || []),
      result.high_threshold ?? null,
      process.env.ML_MODEL_VERSION || null,
      responseMs,
    ]
  );
  const prediction = rows[0];

  if (prediction.risk_level === 'High') {
    const reason = result.top_factors && result.top_factors[0]
      ? ` Top factor: ${result.top_factors[0].feature}.`
      : '';
    await pool.query(
      `INSERT INTO notifications (manager_id, prediction_id, message)
       SELECT manager_id, $1, $2
         FROM shift_managers
        WHERE is_active AND (department_id = $3 OR manager_id = $4)`,
      [
        prediction.prediction_id,
        `High risk incident #${incident.incident_id} (${incident.incident_type}) on the ${shift.shift_type} shift.${reason}`,
        shift.department_id,
        shift.manager_id,
      ]
    );
  }

  return { prediction };
}

async function createIncident(req, res, next) {
  const { shiftId, fields, errors } = readIncident(req.body || {});
  if (Object.keys(errors).length > 0) return invalid(res, errors);

  try {
    const shiftResult = await pool.query(
      'SELECT shift_id, manager_id, department_id, shift_type FROM shifts WHERE shift_id = $1',
      [shiftId]
    );
    const shift = shiftResult.rows[0];
    if (!shift) return res.status(404).json({ message: 'Shift not found' });
    if (shift.manager_id !== req.user.manager_id) {
      return res.status(403).json({ message: 'Only the manager who owns this shift can log incidents on it' });
    }

    if (fields.task_id) {
      const taskResult = await pool.query(
        'SELECT status FROM tasks WHERE task_id = $1 AND shift_id = $2',
        [fields.task_id, shiftId]
      );
      if (!taskResult.rows[0]) return invalid(res, { task_id: 'Task not found on this shift' });
      fields.task_status = fields.task_status || taskResult.rows[0].status;
    }
    if (!fields.task_status) {
      return invalid(res, { task_status: 'task_status is required when no task_id is given' });
    }

    const columns = ['shift_id', 'reported_by', ...Object.keys(fields)];
    const values = [shiftId, req.user.manager_id, ...Object.values(fields)];
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `INSERT INTO incidents (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    const incident = rows[0];

    const { prediction, error } = await runPrediction(incident, shift);
    const body = { incident, prediction };
    if (error) body.prediction_error = error;
    res.status(201).json(body);
  } catch (err) {
    next(err);
  }
}

// Retries the prediction for an incident, e.g. after the ML service was down.
async function predictIncident(req, res, next) {
  const incidentId = parseId(req.params.id);
  if (!incidentId) return res.status(404).json({ message: 'Incident not found' });

  try {
    const { rows } = await pool.query(
      `SELECT i.*, s.manager_id, s.department_id, s.shift_type
         FROM incidents i JOIN shifts s ON s.shift_id = i.shift_id
        WHERE i.incident_id = $1`,
      [incidentId]
    );
    const incident = rows[0];
    if (!incident) return res.status(404).json({ message: 'Incident not found' });
    if (incident.manager_id !== req.user.manager_id) {
      return res.status(403).json({ message: 'Only the manager who owns this shift can run predictions' });
    }

    const { prediction, error } = await runPrediction(incident, incident);
    if (error) return res.status(503).json({ message: error });
    res.status(201).json({ prediction });
  } catch (err) {
    next(err);
  }
}

async function listIncidents(req, res, next) {
  const { shift_id, risk_level, from, to } = req.query;
  const errors = {};
  const shiftId = shift_id === undefined ? null : parseId(shift_id);
  if (shift_id !== undefined && !shiftId) errors.shift_id = 'shift_id must be a positive integer';
  if (risk_level !== undefined && !RISK_LEVELS.includes(risk_level)) {
    errors.risk_level = `risk_level must be one of ${RISK_LEVELS.join(', ')}`;
  }
  if (from !== undefined && !isTimestamp(from)) errors.from = 'from must be a date or date-time';
  if (to !== undefined && !isTimestamp(to)) errors.to = 'to must be a date or date-time';
  if (Object.keys(errors).length > 0) return invalid(res, errors);

  try {
    const { rows } = await pool.query(
      `SELECT i.*, s.shift_type, s.shift_date, d.name AS department_name,
              p.prediction_id, p.risk_level, p.confidence, p.top_factors
         FROM incidents i
         JOIN shifts s ON s.shift_id = i.shift_id
         JOIN departments d ON d.department_id = s.department_id
         ${LATEST_PREDICTION}
        WHERE ($1::int IS NULL OR i.shift_id = $1::int)
          AND ($2::risk_level IS NULL OR p.risk_level = $2::risk_level)
          AND ($3::timestamptz IS NULL OR i.occurred_at >= $3::timestamptz)
          AND ($4::timestamptz IS NULL OR i.occurred_at <= $4::timestamptz)
        ORDER BY i.occurred_at DESC
        LIMIT 200`,
      [shiftId, risk_level ?? null, from ?? null, to ?? null]
    );
    res.json({ incidents: rows });
  } catch (err) {
    next(err);
  }
}

async function getIncident(req, res, next) {
  const incidentId = parseId(req.params.id);
  if (!incidentId) return res.status(404).json({ message: 'Incident not found' });

  try {
    const incidentResult = await pool.query(
      `SELECT i.*, s.shift_type, s.shift_date, s.manager_id AS shift_manager_id,
              d.name AS department_name, t.title AS task_title
         FROM incidents i
         JOIN shifts s ON s.shift_id = i.shift_id
         JOIN departments d ON d.department_id = s.department_id
         LEFT JOIN tasks t ON t.task_id = i.task_id
        WHERE i.incident_id = $1`,
      [incidentId]
    );
    if (!incidentResult.rows[0]) return res.status(404).json({ message: 'Incident not found' });

    const predictions = await pool.query(
      'SELECT * FROM incident_predictions WHERE incident_id = $1 ORDER BY created_at DESC, prediction_id DESC',
      [incidentId]
    );
    res.json({ incident: incidentResult.rows[0], predictions: predictions.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { createIncident, predictIncident, listIncidents, getIncident };
