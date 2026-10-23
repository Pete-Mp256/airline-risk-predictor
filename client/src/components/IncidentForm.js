import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { apiError } from '../api';
import { NUMERIC_FEATURES } from '../utils/features';
import { fromLocalInput, toLocalInput } from '../utils/format';
import { TASK_STATUSES } from '../utils/labels';
import PredictionResult from './PredictionResult';
import RetryPrediction from './RetryPrediction';

const INCIDENT_TYPES = [
  'Tool wear', 'Power failure', 'Overstrain', 'Heat dissipation', 'System fault',
  'Hydraulic leak', 'Avionics fault', 'Structural damage', 'Ground equipment',
];

function emptyForm() {
  return {
    task_id: '',
    task_status: '',
    incident_type: '',
    description: '',
    reported_severity: '',
    occurred_at: toLocalInput(new Date()),
    ...Object.fromEntries(NUMERIC_FEATURES.map((f) => [f.name, ''])),
  };
}

// Logs an incident on a shift and shows the model's risk prediction.
export default function IncidentForm({ shift, tasks, onLogged, onClose }) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { incident, prediction, prediction_error }

  function update(field, value) {
    setForm((f) => {
      const next = { ...f, [field]: value };
      // Picking a task fills in its current status (the model input).
      if (field === 'task_id') {
        const task = tasks.find((t) => String(t.task_id) === value);
        next.task_status = task ? task.status : '';
      }
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    setMessage('');
    try {
      const body = {
        shift_id: shift.shift_id,
        incident_type: form.incident_type,
        description: form.description,
        occurred_at: fromLocalInput(form.occurred_at),
        task_status: form.task_status || undefined,
        task_id: form.task_id ? Number(form.task_id) : undefined,
        reported_severity: form.reported_severity || undefined,
      };
      for (const f of NUMERIC_FEATURES) {
        body[f.name] = form[f.name] === '' ? null : Number(form[f.name]);
      }
      const res = await api.post('/incidents', body);
      setResult(res.data);
      window.dispatchEvent(new Event('notifications:refresh'));
      onLogged();
    } catch (err) {
      const { message: msg, details } = apiError(err);
      setMessage(msg);
      setErrors(details);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const { incident, prediction, prediction_error: predictionError } = result;
    return (
      <div className="space-y-4 rounded-md border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Incident logged: {incident.incident_type}</h3>
          <Link to={`/incidents/${incident.incident_id}`} className="text-sm text-sky-700 hover:underline">
            Open incident
          </Link>
        </div>
        {prediction ? (
          <PredictionResult prediction={prediction} />
        ) : (
          <RetryPrediction
            incidentId={incident.incident_id}
            reason={predictionError}
            canRetry
            onPredicted={(p) => {
              setResult((r) => ({ ...r, prediction: p }));
              onLogged();
            }}
          />
        )}
        <div className="flex gap-2">
          <button type="button" className="btn-primary" onClick={() => { setResult(null); setForm(emptyForm()); }}>
            Log another
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  const error = (name) => errors[name] && <p className="field-error">{errors[name]}</p>;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-md border border-slate-200 bg-slate-50 p-4" noValidate>
      <h3 className="font-semibold">Log incident</h3>
      {message && <p className="alert-error" role="alert">{message}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="incident_type" className="label">Incident type</label>
          <input id="incident_type" list="incident-types" className="input" value={form.incident_type}
            onChange={(e) => update('incident_type', e.target.value)} />
          <datalist id="incident-types">
            {INCIDENT_TYPES.map((t) => <option key={t} value={t} />)}
          </datalist>
          {error('incident_type')}
        </div>
        <div>
          <label htmlFor="occurred_at" className="label">Occurred at</label>
          <input id="occurred_at" type="datetime-local" className="input" value={form.occurred_at}
            onChange={(e) => update('occurred_at', e.target.value)} />
          {error('occurred_at')}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="description" className="label">What happened</label>
          <textarea id="description" rows="2" className="input" value={form.description}
            onChange={(e) => update('description', e.target.value)} />
          {error('description')}
        </div>
        <div>
          <label htmlFor="task_id" className="label">Related task (optional)</label>
          <select id="task_id" className="input" value={form.task_id} onChange={(e) => update('task_id', e.target.value)}>
            <option value="">No task</option>
            {tasks.map((t) => <option key={t.task_id} value={t.task_id}>{t.title}</option>)}
          </select>
          {error('task_id')}
        </div>
        <div>
          <label htmlFor="task_status" className="label">Task status</label>
          <select id="task_status" className="input" value={form.task_status}
            onChange={(e) => update('task_status', e.target.value)}>
            <option value="">Select status</option>
            {TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          {error('task_status')}
        </div>
        <div>
          <label htmlFor="reported_severity" className="label">Your severity estimate (optional)</label>
          <select id="reported_severity" className="input" value={form.reported_severity}
            onChange={(e) => update('reported_severity', e.target.value)}>
            <option value="">Not given</option>
            {['Low', 'Medium', 'High'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-slate-700">Readings used by the risk model</legend>
        <p className="text-xs text-slate-500">Shift type ({shift.shift_type}) is taken from this shift.</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {NUMERIC_FEATURES.map((f) => (
            <div key={f.name}>
              <label htmlFor={f.name} className="label">{f.label} ({f.unit})</label>
              <input id={f.name} type="number" inputMode="decimal" className="input" min={f.min} max={f.max}
                step={f.step} value={form[f.name]} onChange={(e) => update(f.name, e.target.value)}
                aria-describedby={`${f.name}-hint`} />
              {errors[f.name]
                ? <p className="field-error">{errors[f.name]}</p>
                : <p id={`${f.name}-hint`} className="mt-1 text-xs text-slate-500">{f.hint}</p>}
            </div>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Predicting risk…' : 'Log and predict risk'}
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}
