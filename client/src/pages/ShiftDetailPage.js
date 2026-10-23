import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { apiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import IncidentForm from '../components/IncidentForm';
import IncidentList from '../components/IncidentList';
import ShiftNotes from '../components/ShiftNotes';
import TaskList from '../components/TaskList';
import { formatDate, formatTime } from '../utils/format';

// Handover view: everything the incoming manager needs about one shift.
export default function ShiftDetailPage() {
  const { id } = useParams();
  const { manager } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [logging, setLogging] = useState(false);

  const load = useCallback(() => {
    setError('');
    api
      .get(`/shifts/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(apiError(err).message));
  }, [id]);

  useEffect(load, [load]);

  if (error) {
    return (
      <div className="space-y-3">
        <p className="alert-error" role="alert">{error}</p>
        <Link to="/shifts" className="text-sm text-sky-700 hover:underline">Back to shifts</Link>
      </div>
    );
  }
  if (!data) return <p className="text-sm text-slate-500">Loading shift…</p>;

  const { shift, tasks, incidents } = data;
  const isOwner = shift.manager_id === manager.manager_id;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/shifts" className="text-sm text-sky-700 hover:underline">← All shifts</Link>
        <h1 className="mt-1 text-2xl font-semibold">
          {shift.shift_type} shift · {formatDate(shift.shift_date)}
        </h1>
        <p className="text-sm text-slate-600">
          {shift.department_name} · {formatTime(shift.start_time)}–{formatTime(shift.end_time)} ·{' '}
          {shift.manager_name} · {shift.staff_count} staff
        </p>
        {!isOwner && (
          <p className="mt-2 inline-block rounded-md bg-slate-100 px-3 py-1 text-xs text-slate-600">
            Read-only: this shift belongs to {shift.manager_name}.
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <ShiftNotes
            shift={shift}
            canEdit={isOwner}
            onSaved={(updated) => setData((d) => ({ ...d, shift: { ...d.shift, ...updated } }))}
          />
          <TaskList
            shiftId={shift.shift_id}
            tasks={tasks}
            canEdit={isOwner}
            onChange={(next) => setData((d) => ({ ...d, tasks: next }))}
          />
        </div>
        <IncidentList
          incidents={incidents}
          action={isOwner && !logging && (
            <button type="button" className="btn-primary px-3 py-1.5" onClick={() => setLogging(true)}>
              Log incident
            </button>
          )}
        >
          {logging && (
            <IncidentForm shift={shift} tasks={tasks} onLogged={load} onClose={() => setLogging(false)} />
          )}
        </IncidentList>
      </div>
    </div>
  );
}
