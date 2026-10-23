// Maps client-friendly values to the exact labels the model was trained on
// (model_meta.json categorical features). Returns null for unknown values.

const SHIFT_TYPES = ['Morning', 'Afternoon', 'Night'];
const TASK_STATUSES = ['Pending', 'In Progress', 'Complete'];

const TASK_STATUS_ALIASES = {
  'pending': 'Pending',
  'in-progress': 'In Progress',
  'in progress': 'In Progress',
  'in_progress': 'In Progress',
  'complete': 'Complete',
  'completed': 'Complete',
};

function normalise(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : null;
}

function toShiftType(value) {
  const key = normalise(value);
  return SHIFT_TYPES.find((label) => label.toLowerCase() === key) || null;
}

function toTaskStatus(value) {
  const key = normalise(value);
  return key === null ? null : TASK_STATUS_ALIASES[key] || null;
}

module.exports = { SHIFT_TYPES, TASK_STATUSES, toShiftType, toTaskStatus };
