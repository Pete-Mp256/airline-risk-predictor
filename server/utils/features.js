// Plain-language names and units for the model inputs, for emails.
// Mirrors client/src/utils/features.js.
const FEATURES = {
  shift_type: ['Shift type'],
  task_status: ['Task status'],
  severity_score: ['Severity score'],
  tool_wear_min: ['Tool wear', 'min'],
  air_temp_k: ['Air temperature', 'K'],
  process_temp_k: ['Process temperature', 'K'],
  rotational_speed: ['Rotational speed', 'rpm'],
  resolution_time: ['Expected resolution time', 'min'],
};

// "Tool wear (210 min)", "Severity score (0.95)"
function describeFeature(name, value) {
  const [label = name, unit] = FEATURES[name] || [];
  return `${label} (${unit ? `${value} ${unit}` : value})`;
}

module.exports = { describeFeature };
