import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { apiError } from '../api';
import { toast } from 'components/ui/sonner';
import { formatDateTime } from '../utils/format';
import { HandoverStatusBadge } from './Badges';
import HandoverItems from './HandoverItems';

const firstError = (err) => {
  const { message, details } = apiError(err);
  return Object.values(details)[0] || message;
};

function recipientName(handover) {
  return handover.to_manager_name || `Everyone in ${handover.department_name}`;
}

// The shift's handover. Owner: start it, then edit summary, incoming person and notes while Draft,
// and submit. After submit, or for anyone else, read-only with its status.
export default function HandoverPanel({ shift, isOwner, onChanged }) {
  const [handover, setHandover] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [staff, setStaff] = useState([]);
  const [summary, setSummary] = useState('');
  const [toId, setToId] = useState('');
  const [note, setNote] = useState('');

  const show = useCallback((data) => {
    setHandover(data.handover);
    setItems(data.items);
    setSummary(data.handover.summary || '');
    setToId(data.handover.to_manager_id ? String(data.handover.to_manager_id) : '');
  }, []);

  useEffect(() => {
    if (!shift.handover_id) return;
    api
      .get(`/handovers/${shift.handover_id}`)
      .then((res) => show(res.data))
      .catch((err) => (err.response?.status === 403 ? setHidden(true) : setError(apiError(err).message)));
  }, [shift.handover_id, show]);

  const editing = isOwner && handover?.status === 'Draft';

  useEffect(() => {
    if (!editing) return;
    api.get('/managers').then((res) => setStaff(res.data.managers)).catch(() => {});
  }, [editing]);

  const dirty = handover && (summary.trim() !== (handover.summary || '') ||
    toId !== (handover.to_manager_id ? String(handover.to_manager_id) : ''));

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(firstError(err));
    } finally {
      setBusy(false);
    }
  }

  const start = () => run(async () => {
    const res = await api.post(`/shifts/${shift.shift_id}/handover`, {});
    show(res.data);
    onChanged({ handover_id: res.data.handover.handover_id, handover_status: 'Draft' });
  });

  async function saveFields() {
    const res = await api.patch(`/handovers/${handover.handover_id}`, {
      summary: summary.trim() || null,
      to_manager_id: toId ? Number(toId) : null,
    });
    const to = staff.find((s) => String(s.manager_id) === toId);
    setHandover((h) => ({ ...h, ...res.data.handover, to_manager_name: to ? `${to.first_name} ${to.last_name}` : null }));
  }

  const save = () => run(async () => {
    await saveFields();
    toast.success('Handover saved');
  });

  const submit = () => run(async () => {
    if (dirty) await saveFields();
    const res = await api.post(`/handovers/${handover.handover_id}/submit`);
    setHandover((h) => ({ ...h, ...res.data.handover }));
    setItems(res.data.items);
    onChanged({ handover_status: 'Submitted' });
    toast.success(`Handover submitted to ${toId ? 'the incoming person' : 'the department'}`);
  });

  async function addNote(e) {
    e.preventDefault();
    if (!note.trim()) return;
    await run(async () => {
      const res = await api.post(`/handovers/${handover.handover_id}/notes`, { note });
      setItems((list) => [...list, res.data.item]);
      setNote('');
    });
  }

  async function removeNote(item) {
    setBusyId(item.item_id);
    await run(async () => {
      await api.delete(`/handovers/${handover.handover_id}/items/${item.item_id}`);
      setItems((list) => list.filter((i) => i.item_id !== item.item_id));
    });
    setBusyId(null);
  }

  const heading = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="section-title">Handover</h2>
      {handover && <HandoverStatusBadge status={handover.status} />}
    </div>
  );

  if (!shift.handover_id) {
    return (
      <section className="card space-y-3">
        {heading}
        {error && <p className="alert-error" role="alert">{error}</p>}
        {isOwner ? (
          <>
            <p className="text-sm text-slate-600">
              Start the handover to pass this shift&apos;s open tasks, incidents and your notes to the next person on duty.
            </p>
            <button type="button" className="btn-primary" onClick={start} disabled={busy}>
              {busy ? 'Starting…' : 'Start handover'}
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-500">No handover started for this shift yet.</p>
        )}
      </section>
    );
  }

  if (hidden) {
    return (
      <section className="card space-y-2">
        {heading}
        <p className="text-sm text-slate-500">Only the sender, the incoming person and the shift&apos;s department can see this handover.</p>
      </section>
    );
  }

  if (!handover) {
    return (
      <section className="card space-y-2">
        {heading}
        {error ? <p className="alert-error" role="alert">{error}</p> : <p className="text-sm text-slate-500">Loading handover…</p>}
      </section>
    );
  }

  if (editing) {
    return (
      <section className="card space-y-4">
        {heading}
        {error && <p className="alert-error" role="alert">{error}</p>}
        <div>
          <label htmlFor="handover-to" className="label">Incoming person</label>
          <select id="handover-to" className="input" value={toId} onChange={(e) => setToId(e.target.value)}>
            <option value="">Everyone in {handover.department_name}</option>
            {staff.filter((s) => s.manager_id !== handover.from_manager_id).map((s) => (
              <option key={s.manager_id} value={s.manager_id}>
                {s.first_name} {s.last_name}{s.department_name ? ` · ${s.department_name}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="handover-summary" className="label">Summary for the next shift</label>
          <textarea id="handover-summary" rows="4" className="input" value={summary}
            placeholder="What the incoming person needs to know first"
            onChange={(e) => setSummary(e.target.value)} />
        </div>

        <HandoverItems items={items} onRemove={removeNote} busyId={busyId} />

        <form onSubmit={addNote} className="flex gap-2">
          <label htmlFor="handover-note" className="sr-only">Add a note</label>
          <input id="handover-note" className="input" placeholder="Add a note" value={note}
            onChange={(e) => setNote(e.target.value)} />
          <button type="submit" className="btn-secondary shrink-0 px-4" disabled={busy || !note.trim()}>Add</button>
        </form>

        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
          <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Working…' : 'Submit handover'}
          </button>
          <button type="button" className="btn-secondary" onClick={save} disabled={busy || !dirty}>Save draft</button>
        </div>
        <p className="text-xs text-slate-500">After you submit, the handover can no longer be changed.</p>
      </section>
    );
  }

  return (
    <section className="card space-y-4">
      {heading}
      {error && <p className="alert-error" role="alert">{error}</p>}
      <dl className="grid gap-1 text-sm">
        <div><dt className="inline text-slate-500">From: </dt><dd className="inline">{handover.from_manager_name}</dd></div>
        <div><dt className="inline text-slate-500">To: </dt><dd className="inline">{recipientName(handover)}</dd></div>
        {handover.submitted_at && (
          <div><dt className="inline text-slate-500">Submitted: </dt><dd className="inline">{formatDateTime(handover.submitted_at)}</dd></div>
        )}
        {handover.acknowledged_at && (
          <div><dt className="inline text-slate-500">Acknowledged: </dt><dd className="inline">{formatDateTime(handover.acknowledged_at)}</dd></div>
        )}
      </dl>
      {handover.status === 'Draft' ? (
        <p className="text-sm text-slate-500">{handover.from_manager_name} is still preparing this handover.</p>
      ) : (
        <>
          <p className="whitespace-pre-line text-sm text-slate-700">{handover.summary}</p>
          <HandoverItems items={items} />
          <Link to={`/handovers/${handover.handover_id}`} className="link inline-block text-sm">Open handover →</Link>
        </>
      )}
    </section>
  );
}
