import { useState } from 'react';
import api, { apiError } from '../api';

// Handover notes and staff count; editable by the shift owner only.
export default function ShiftNotes({ shift, canEdit, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(shift.notes || '');
  const [staffCount, setStaffCount] = useState(String(shift.staff_count));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setNotes(shift.notes || '');
    setStaffCount(String(shift.staff_count));
    setError('');
    setEditing(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await api.patch(`/shifts/${shift.shift_id}`, {
        notes: notes.trim() || null,
        staff_count: staffCount === '' ? 0 : Number(staffCount),
      });
      onSaved(res.data.shift);
      setEditing(false);
    } catch (err) {
      const { message, details } = apiError(err);
      setError(Object.values(details)[0] || message);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={save} className="card space-y-3">
        <h2 className="section-title">Handover notes</h2>
        {error && <p className="alert-error" role="alert">{error}</p>}
        <div>
          <label htmlFor="notes" className="label">Notes for the next shift</label>
          <textarea id="notes" rows="4" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="max-w-[10rem]">
          <label htmlFor="staff_count" className="label">Staff on shift</label>
          <input id="staff_count" type="number" min="0" step="1" className="input" value={staffCount}
            onChange={(e) => setStaffCount(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </form>
    );
  }

  return (
    <section className="card">
      <div className="flex items-start justify-between gap-3">
        <h2 className="section-title">Handover notes</h2>
        {canEdit && <button type="button" className="btn-secondary px-3 py-1.5" onClick={startEdit}>Edit</button>}
      </div>
      {shift.notes ? (
        <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{shift.notes}</p>
      ) : (
        <p className="mt-2 text-sm text-slate-500">No notes yet.</p>
      )}
    </section>
  );
}
