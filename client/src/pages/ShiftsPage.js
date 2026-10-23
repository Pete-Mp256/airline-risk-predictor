import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { apiError } from '../api';
import NewShiftForm from '../components/NewShiftForm';
import { formatDate, formatTime } from '../utils/format';

export default function ShiftsPage() {
  const navigate = useNavigate();
  const [shifts, setShifts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({ date: '', department_id: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get('/departments').then((res) => setDepartments(res.data.departments)).catch(() => {});
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Shifts</h1>
          <p className="text-sm text-slate-500">Open a shift to see its handover: notes, tasks and incidents.</p>
        </div>
        {!creating && (
          <button type="button" className="btn-primary" onClick={() => setCreating(true)}>New shift</button>
        )}
      </div>

      {creating && (
        <NewShiftForm
          departments={departments}
          onCreated={(shift) => navigate(`/shifts/${shift.shift_id}`)}
          onCancel={() => setCreating(false)}
        />
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="filter-date" className="label">Date</label>
          <input id="filter-date" type="date" className="input" value={filters.date}
            onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))} />
        </div>
        <div>
          <label htmlFor="filter-dept" className="label">Department</label>
          <select id="filter-dept" className="input" value={filters.department_id}
            onChange={(e) => setFilters((f) => ({ ...f, department_id: e.target.value }))}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}
          </select>
        </div>
        {(filters.date || filters.department_id) && (
          <button type="button" className="btn-secondary"
            onClick={() => setFilters({ date: '', department_id: '' })}>Clear filters</button>
        )}
      </div>

      {error && <p className="alert-error" role="alert">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Shift</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Manager</th>
              <th className="px-4 py-3 text-right">Staff</th>
              <th className="px-4 py-3 text-right">Open tasks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500">Loading shifts…</td></tr>
            ) : shifts.length === 0 ? (
              <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500">No shifts found.</td></tr>
            ) : (
              shifts.map((s) => (
                <tr key={s.shift_id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link to={`/shifts/${s.shift_id}`} className="font-medium text-sky-700 hover:underline">
                      {formatDate(s.shift_date)}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {s.shift_type}
                    <span className="ml-1 text-slate-500">{formatTime(s.start_time)}–{formatTime(s.end_time)}</span>
                  </td>
                  <td className="px-4 py-3">{s.department_name}</td>
                  <td className="px-4 py-3">{s.manager_name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.staff_count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {s.open_task_count} <span className="text-slate-400">/ {s.task_count}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
