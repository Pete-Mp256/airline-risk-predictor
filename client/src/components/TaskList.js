import { useState } from 'react';
import api, { apiError } from '../api';
import { TASK_STATUSES } from '../utils/labels';
import { StatusBadge } from './Badges';

const EMPTY_TASK = {
  title: '', aircraft_reg: '', task_type: '', complexity: '', estimated_hours: '', status: 'Pending', description: '',
};

function AddTaskForm({ shiftId, onAdded, onCancel }) {
  const [form, setForm] = useState(EMPTY_TASK);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setMessage('');
    try {
      const body = { title: form.title, status: form.status };
      for (const field of ['aircraft_reg', 'task_type', 'description']) {
        if (form[field].trim()) body[field] = form[field].trim();
      }
      if (form.complexity) body.complexity = Number(form.complexity);
      if (form.estimated_hours !== '') body.estimated_hours = Number(form.estimated_hours);
      const res = await api.post(`/shifts/${shiftId}/tasks`, body);
      onAdded(res.data.task);
      setForm(EMPTY_TASK);
    } catch (err) {
      const { message: msg, details } = apiError(err);
      setMessage(msg);
      setErrors(details);
    } finally {
      setSaving(false);
    }
  }

  const error = (name) => errors[name] && <p className="field-error">{errors[name]}</p>;

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4" noValidate>
      <h3 className="text-sm font-semibold">Add task</h3>
      {message && <p className="alert-error" role="alert">{message}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <label htmlFor="task-title" className="label">Title</label>
          <input id="task-title" className="input" value={form.title} onChange={set('title')} />
          {error('title')}
        </div>
        <div>
          <label htmlFor="task-reg" className="label">Aircraft reg.</label>
          <input id="task-reg" className="input" placeholder="5Y-KZA" value={form.aircraft_reg} onChange={set('aircraft_reg')} />
          {error('aircraft_reg')}
        </div>
        <div>
          <label htmlFor="task-type" className="label">Task type</label>
          <input id="task-type" className="input" placeholder="Scheduled, Corrective…" value={form.task_type} onChange={set('task_type')} />
          {error('task_type')}
        </div>
        <div>
          <label htmlFor="task-status" className="label">Status</label>
          <select id="task-status" className="input" value={form.status} onChange={set('status')}>
            {TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="task-complexity" className="label">Complexity (1–5)</label>
          <select id="task-complexity" className="input" value={form.complexity} onChange={set('complexity')}>
            <option value="">Not set</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}
          </select>
          {error('complexity')}
        </div>
        <div>
          <label htmlFor="task-hours" className="label">Estimated hours</label>
          <input id="task-hours" type="number" min="0" step="0.25" className="input" value={form.estimated_hours} onChange={set('estimated_hours')} />
          {error('estimated_hours')}
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label htmlFor="task-desc" className="label">Description (optional)</label>
          <textarea id="task-desc" rows="2" className="input" value={form.description} onChange={set('description')} />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={saving || !form.title.trim()}>
          {saving ? 'Adding…' : 'Add task'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Close</button>
      </div>
    </form>
  );
}

export default function TaskList({ shiftId, tasks, canEdit, onChange }) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);

  async function changeStatus(task, status) {
    setSavingId(task.task_id);
    setError('');
    try {
      const res = await api.patch(`/tasks/${task.task_id}`, { status });
      onChange(tasks.map((t) => (t.task_id === task.task_id ? res.data.task : t)));
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setSavingId(null);
    }
  }

  const openCount = tasks.filter((t) => t.status !== 'Complete').length;

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Tasks <span className="text-sm font-normal text-slate-500">({openCount} open of {tasks.length})</span>
        </h2>
        {canEdit && !adding && (
          <button type="button" className="btn-secondary px-3 py-1.5" onClick={() => setAdding(true)}>Add task</button>
        )}
      </div>
      {error && <p className="alert-error mt-3" role="alert">{error}</p>}

      {tasks.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No tasks on this shift.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {tasks.map((t) => (
            <li key={t.task_id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t.title}</p>
                <p className="text-xs text-slate-500">
                  {[t.aircraft_reg, t.task_type, t.complexity && `complexity ${t.complexity}`,
                    t.estimated_hours != null && `${t.estimated_hours} h`].filter(Boolean).join(' · ')}
                </p>
                {t.description && <p className="mt-1 text-sm text-slate-600">{t.description}</p>}
              </div>
              {canEdit ? (
                <select
                  aria-label={`Status of ${t.title}`}
                  className="input w-auto py-1"
                  value={t.status}
                  disabled={savingId === t.task_id}
                  onChange={(e) => changeStatus(t, e.target.value)}
                >
                  {TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              ) : (
                <StatusBadge status={t.status} />
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <AddTaskForm
          shiftId={shiftId}
          onAdded={(task) => onChange([...tasks, task])}
          onCancel={() => setAdding(false)}
        />
      )}
    </section>
  );
}
