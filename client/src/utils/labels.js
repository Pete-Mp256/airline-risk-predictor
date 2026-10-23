// Labels the API accepts (same as the model's categorical values).
export const SHIFT_TYPES = ['Morning', 'Afternoon', 'Night'];
export const TASK_STATUSES = ['Pending', 'In Progress', 'Complete'];

// Default start hour and length for each shift type.
export const SHIFT_HOURS = {
  Morning: { start: 6, hours: 8 },
  Afternoon: { start: 14, hours: 8 },
  Night: { start: 22, hours: 8 },
};
