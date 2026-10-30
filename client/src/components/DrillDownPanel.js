import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { apiError } from '../api';
import { formatDate, formatDateTime } from '../utils/format';
import { RiskBadge, StatusBadge } from './Badges';

const LIST_LIMIT = 200; // same cap as the API

function IncidentRow({ incident: i }) {
  return (
    <li>
      <Link to={`/incidents/${i.incident_id}`}
        className="tile flex flex-wrap items-center justify-between gap-3 transition hover:ring-accent-300">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{i.incident_type}</p>
          <p className="text-xs text-slate-500">
            {formatDateTime(i.occurred_at)} · {i.shift_type} shift · {i.department_name}
          </p>
        </div>
        <RiskBadge level={i.risk_level} confidence={i.confidence} />
      </Link>
    </li>
  );
}

// Tasks have no page of their own; they open on their shift's handover page.
function TaskRow({ task: t }) {
  return (
    <li>
      <Link to={`/shifts/${t.shift_id}`}
        className="tile flex flex-wrap items-center justify-between gap-3 transition hover:ring-accent-300">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {t.title}
            {t.aircraft_reg && <span className="font-normal text-slate-500"> · {t.aircraft_reg}</span>}
          </p>
          <p className="text-xs text-slate-500">
            {formatDate(t.shift_date)} · {t.shift_type} shift · {t.department_name}
          </p>
        </div>
        <StatusBadge status={t.status} />
      </Link>
    </li>
  );
}

// The incidents or open tasks behind a dashboard number.
// selection: { kind: 'incidents' | 'tasks', filters, label }
export default function DrillDownPanel({ selection, days, onClose }) {
  const [state, setState] = useState({ loading: true, items: [], error: '' });
  const ref = useRef(null);

  useEffect(() => {
    // Scrolls only when the panel is off screen (e.g. after clicking a chart lower down).
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selection]);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: '' }));
    const request = selection.kind === 'tasks'
      ? api.get('/dashboard/open-tasks', { params: { days } }).then((res) => res.data.tasks)
      : api.get('/dashboard/incidents', { params: { days, ...selection.filters } }).then((res) => res.data.incidents);
    request
      .then((items) => !cancelled && setState({ loading: false, items, error: '' }))
      .catch((err) => !cancelled && setState({ loading: false, items: [], error: apiError(err).message }));
    return () => { cancelled = true; };
  }, [selection, days]);

  const { loading, items, error } = state;
  const noun = selection.kind === 'tasks' ? 'open tasks' : 'incidents';

  return (
    <section ref={ref} className="card scroll-mt-4" aria-label={`Showing ${selection.label}`} aria-busy={loading}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title">
          Showing: <span className="normal-case tracking-normal text-slate-900">{selection.label}</span>
          {!loading && !error && (
            <span className="ml-1 text-sm font-normal normal-case tracking-normal text-slate-500">({items.length})</span>
          )}
        </h2>
        <button type="button" className="btn-secondary px-4 py-1 text-xs" onClick={onClose}>Close</button>
      </div>

      {error ? (
        <p className="alert-error" role="alert">{error}</p>
      ) : loading ? (
        <p className="py-4 text-center text-sm text-slate-500">Loading {noun}…</p>
      ) : items.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">No {noun} in the last {days} days.</p>
      ) : (
        <>
          <ul className="max-h-[28rem] space-y-2 overflow-auto">
            {selection.kind === 'tasks'
              ? items.map((t) => <TaskRow key={t.task_id} task={t} />)
              : items.map((i) => <IncidentRow key={i.incident_id} incident={i} />)}
          </ul>
          {items.length >= LIST_LIMIT && (
            <p className="mt-2 text-xs text-slate-500">Showing the latest {LIST_LIMIT}.</p>
          )}
        </>
      )}
    </section>
  );
}
