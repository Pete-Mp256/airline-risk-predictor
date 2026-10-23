// The model's numeric inputs, with units and typical ranges (5th-95th percentile of the
// training data, merged_dataset.csv) shown as hints on the form.
export const NUMERIC_FEATURES = [
  { name: 'severity_score', label: 'Severity score', unit: '0–1', min: 0, max: 1, step: 0.01,
    hint: '0 = minor, 1 = most severe' },
  { name: 'tool_wear_min', label: 'Tool wear', unit: 'min', min: 0, step: 1, hint: 'Typical 10–255 min' },
  { name: 'air_temp_k', label: 'Air temperature', unit: 'K', min: 0.01, step: 0.1, hint: 'Typical 295–305 K' },
  { name: 'process_temp_k', label: 'Process temperature', unit: 'K', min: 0.01, step: 0.1, hint: 'Typical 305–315 K' },
  { name: 'rotational_speed', label: 'Rotational speed', unit: 'rpm', min: 1, step: 1, hint: 'Typical 1,270–2,700 rpm' },
  { name: 'resolution_time', label: 'Expected resolution time', unit: 'min', min: 0, step: 1, hint: 'Typical 35–455 min' },
];

const LABELS = {
  shift_type: 'Shift type',
  task_status: 'Task status',
  ...Object.fromEntries(NUMERIC_FEATURES.map((f) => [f.name, f.label])),
};
const UNITS = Object.fromEntries(NUMERIC_FEATURES.map((f) => [f.name, f.unit]));

export function featureLabel(name) {
  return LABELS[name] || name;
}

// "Tool wear (210 min)", "Shift type (Night)"
export function describeFeature(name, value) {
  const unit = UNITS[name];
  const shown = typeof value === 'number' && unit && unit !== '0–1' ? `${value} ${unit}` : value;
  return `${featureLabel(name)} (${shown})`;
}
