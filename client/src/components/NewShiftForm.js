import { useState } from 'react';
import api, { apiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import { fromLocalInput, toLocalInput, todayISODate } from '../utils/format';
import { SHIFT_HOURS, SHIFT_TYPES } from '../utils/labels';

// Start and end for a shift type on a date, e.g. Night 22:00 -> 06:00 next day.
function defaultTimes(shiftType, date) {
  const { start, hours } = SHIFT_HOURS[shiftType];
  const begin = new Date(`${date}T00:00:00`);
  begin.setHours(start);
  const end = new Date(begin.getTime() + hours * 3600 * 1000);
  return { start_time: toLocalInput(begin), end_time: toLocalInput(end) };
}

function guessShiftType() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return 'Morning';
  if (hour >= 14 && hour < 22) return 'Afternoon';
  return 'Night';
}

export default function NewShiftForm({ departments, onCreated, onCancel }) {
  const { manager } = useAuth();
  const [form, setForm] = useState(() => {
    const shiftType = guessShiftType();
    const date = todayISODate();
    return {
      shift_type: shiftType,
      shift_date: date,
      ...defaultTimes(shiftType, date),
      staff_count: '',
      department_id: manager.department_id ? String(manager.department_id) : '',
      notes: '',
    };
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Changing the type or date resets the times to that shift's defaults.
  function update(field, value) {
    setForm((f) => {
      const next = { ...f, [field]: value };
      if ((field === 'shift_type' || field === 'shift_date') && next.shift_date) {
        Object.assign(next, defaultTimes(next.shift_type, next.shift_date));
      }
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    setErrors({});
    setSubmitting(true);
    try {
      const res = await api.post('/shifts', {
        shift_type: form.shift_type,
        shift_date: form.shift_date,
        start_time: fromLocalInput(form.start_time),
        end_time: fromLocalInput(form.end_time),
        staff_count: form.staff_count === '' ? 0 : Number(form.staff_count),
        department_id: form.department_id ? Number(form.department_id) : undefined,
        notes: form.notes.trim() || null,
      });
      onCreated(res.data.shift);
    } catch (err) {
      const { message: msg, details } = apiError(err);
      setMessage(msg);
      setErrors(details);
      setSubmitting(false);
    }
  }

  const error = (name) => errors[name] && <p className="field-error">{errors[name]}</p>;

  return (
    <form onSubmit={handleSubmit} className="card space-y-4" noValidate>
      <h2 className="text-lg font-semibold">New shift</h2>
      {message && <p className="alert-error" role="alert">{message}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="shift_type" className="label">Shift type</label>
          <select id="shift_type" className="input" value={form.shift_type}
            onChange={(e) => update('shift_type', e.target.value)}>
            {SHIFT_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          {error('shift_type')}
        </div>
        <div>
          <label htmlFor="shift_date" className="label">Date</label>
          <input id="shift_date" type="date" className="input" value={form.shift_date}
            onChange={(e) => update('shift_date', e.target.value)} />
          {error('shift_date')}
        </div>
        <div>
          <label htmlFor="department_id" className="label">Department</label>
          <select id="department_id" className="input" value={form.department_id}
            onChange={(e) => update('department_id', e.target.value)}>
            <option value="">Select a department</option>
            {departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}
          </select>
          {error('department_id')}
        </div>
        <div>
          <label htmlFor="start_time" className="label">Starts</label>
          <input id="start_time" type="datetime-local" className="input" value={form.start_time}
            onChange={(e) => update('start_time', e.target.value)} />
          {error('start_time')}
        </div>
        <div>
          <label htmlFor="end_time" className="label">Ends</label>
          <input id="end_time" type="datetime-local" className="input" value={form.end_time}
            onChange={(e) => update('end_time', e.target.value)} />
          {error('end_time')}
        </div>
        <div>
          <label htmlFor="staff_count" className="label">Staff on shift</label>
          <input id="staff_count" type="number" min="0" step="1" className="input" value={form.staff_count}
            onChange={(e) => update('staff_count', e.target.value)} />
          {error('staff_count')}
        </div>
      </div>
      <div>
        <label htmlFor="notes" className="label">Notes (optional)</label>
        <textarea id="notes" rows="2" className="input" value={form.notes}
          onChange={(e) => update('notes', e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create shift'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
