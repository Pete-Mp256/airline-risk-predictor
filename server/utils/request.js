// Small helpers shared by the route controllers.

// Route ids must be positive integers; anything else is treated as not found.
function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isBlank(value) {
  return typeof value !== 'string' || value.trim() === '';
}

function isTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

// Builds "col1 = $1, col2 = $2" from the fields present in `updates`.
function buildSet(updates) {
  const columns = Object.keys(updates);
  return {
    clause: columns.map((col, i) => `${col} = $${i + 1}`).join(', '),
    values: columns.map((col) => updates[col]),
  };
}

function invalid(res, details) {
  return res.status(400).json({ message: 'Invalid input', details });
}

module.exports = { parseId, isBlank, isTimestamp, buildSet, invalid };
