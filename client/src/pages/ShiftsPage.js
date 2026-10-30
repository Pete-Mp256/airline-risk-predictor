import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { apiError } from '../api';
import { PlaneIcon, SearchIcon, ShiftIcon } from '../components/Icons';
import NewShiftForm from '../components/NewShiftForm';
import PageHeader from '../components/PageHeader';
import Timeline from '../components/Timeline';
import { formatDate, formatDateTime, formatDuration, formatTime } from '../utils/format';
import { SHIFT_TYPES } from '../utils/labels';

const EMPTY_FILTERS = { date: '', department_id: '' };

function ShiftRow({ shift }) {
  return (
    <li className="tile flex items-center gap-3 sm:gap-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-700">
        <ShiftIcon type={shift.shift_type} />
      </span>
      <div className="min-w-0 flex-1 sm:w-28 sm:flex-none">
        <p className="whitespace-nowrap text-sm font-semibold tabular-nums">
          {formatTime(shift.start_time)}
          <span className="sm:hidden"> – {formatTime(shift.end_time)}</span>
        </p>
        <p className="truncate text-xs text-slate-500">{shift.shift_type} · {shift.staff_count} staff</p>
        <p className="truncate text-xs text-slate-500 sm:hidden">{shift.department_name} · {shift.manager_name}</p>
      </div>
      <div className="hidden min-w-[8rem] flex-1 flex-col items-center text-xs text-slate-500 sm:flex">
        <span>{formatDuration(shift.start_time, shift.end_time)}</span>
        <span className="my-1 flex w-full items-center gap-1 text-accent-400">
          <span className="h-2 w-2 rounded-full border-2 border-accent-300" />
          <span className="h-px flex-1 border-t border-dashed border-accent-300" />
          <PlaneIcon className="h-4 w-4 rotate-45" />
        </span>
        <span className="truncate">{shift.manager_name}</span>
      </div>
      <div className="hidden w-36 shrink-0 sm:block">
        <p className="text-sm font-semibold tabular-nums">{formatTime(shift.end_time)}</p>
        <p className="truncate text-xs text-slate-500">{shift.department_name}</p>
      </div>
      <div className="ml-auto flex shrink-0 flex-col items-end gap-1.5">
        <p className="text-right">
          <span className="text-xl font-semibold tabular-nums">{shift.open_task_count}</span>
          <span className="text-xs text-slate-500"> / {shift.task_count}<span className="hidden sm:inline"> open tasks</span></span>
        </p>
        <Link to={`/shifts/${shift.shift_id}`} className="btn-dark px-4 py-1 text-xs"
          aria-label={`Open ${shift.shift_type} shift on ${formatDate(shift.shift_date)}`}>
          Open
        </Link>
      </div>
    </li>
  );
}

export default function ShiftsPage() {
  const navigate = useNavigate();
  const [shifts, setShifts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [shiftType, setShiftType] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get('/departments').then((res) => setDepartments(res.data.departments)).catch(() => {});
    api.get('/incidents').then((res) => setIncidents(res.data.incidents.slice(0, 6))).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const params = {};
    if (filters.date) params.date = filters.date;
    if (filters.department_id) params.department_id = filters.department_id;
    api
      .get('/shifts', { params })
      .then((res) => setShifts(res.data.shifts))
      .catch((err) => setError(apiError(err).message))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(load, [load]);

  // Shifts of the selected type, grouped by date (newest first, as returned by the API).
  const groups = useMemo(() => {
    const visible = shiftType === 'All' ? shifts : shifts.filter((s) => s.shift_type === shiftType);
    const byDate = new Map();
    for (const s of visible) {
      if (!byDate.has(s.shift_date)) byDate.set(s.shift_date, []);
      byDate.get(s.shift_date).push(s);
    }
    return [...byDate.entries()];
  }, [shifts, shiftType]);

  function search(e) {
    e.preventDefault();
    setFilters(draft);
  }

  const filtered = filters.date || filters.department_id;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shift handovers"
        plane
        actions={!creating && (
          <button type="button" className="btn-dark" onClick={() => setCreating(true)}>New shift</button>
        )}
      />

      {creating && (
        <NewShiftForm
          departments={departments}
          onCreated={(shift) => navigate(`/shifts/${shift.shift_id}`)}
          onCancel={() => setCreating(false)}
        />
      )}

      <form onSubmit={search}
        className="flex flex-wrap items-end gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 sm:flex-nowrap sm:px-6">
        <div className="w-full sm:w-auto sm:flex-1">
          <label htmlFor="filter-date" className="label">Date</label>
          <input id="filter-date" type="date" className="input border-transparent bg-slate-50 font-medium"
            value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
        </div>
        <span className="hidden h-10 w-px bg-slate-200 sm:block" aria-hidden="true" />
        <div className="w-full sm:w-auto sm:flex-1">
          <label htmlFor="filter-dept" className="label">Department</label>
          <select id="filter-dept" className="input border-transparent bg-slate-50 font-medium"
            value={draft.department_id} onChange={(e) => setDraft((d) => ({ ...d, department_id: e.target.value }))}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          {filtered && (
            <button type="button" className="btn-secondary"
              onClick={() => { setDraft(EMPTY_FILTERS); setFilters(EMPTY_FILTERS); }}>Clear</button>
          )}
          <button type="submit" className="btn-primary"><SearchIcon className="h-4 w-4" />Search</button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Shift type">
        {['All', ...SHIFT_TYPES].map((t) => (
          <button key={t} type="button" role="tab" aria-selected={shiftType === t}
            className={shiftType === t ? 'pill-active' : 'pill bg-white ring-1 ring-slate-200'}
            onClick={() => setShiftType(t)}>
            {t}
          </button>
        ))}
      </div>

      {error && <p className="alert-error" role="alert">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card min-w-0 lg:col-span-2" aria-label="Shifts">
          {loading ? (
            <p className="py-6 text-center text-sm text-slate-500">Loading shifts…</p>
          ) : groups.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No shifts found.</p>
          ) : (
            <div className="space-y-5">
              {groups.map(([date, list]) => (
                <div key={date}>
                  <h2 className="section-title mb-2">{formatDate(date)}</h2>
                  <ul className="space-y-2">
                    {list.map((s) => <ShiftRow key={s.shift_id} shift={s} />)}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="card min-w-0 self-start">
          <h2 className="section-title mb-4">Latest incidents</h2>
          <Timeline
            empty="No incidents logged yet."
            items={incidents.map((i) => ({
              id: i.incident_id,
              when: formatDateTime(i.occurred_at),
              title: i.incident_type,
              detail: `${i.risk_level ? `${i.risk_level} risk` : 'Not predicted'} · ${i.shift_type} · ${i.department_name}`,
              tone: i.risk_level || 'muted',
              alert: i.risk_level === 'High',
              to: `/incidents/${i.incident_id}`,
            }))}
          />
        </aside>
      </div>
    </div>
  );
}
