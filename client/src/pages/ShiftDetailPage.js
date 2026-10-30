import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { apiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import IncidentForm from '../components/IncidentForm';
import IncidentList from '../components/IncidentList';
import PageHeader from '../components/PageHeader';
import ShiftNotes from '../components/ShiftNotes';
import TaskList from '../components/TaskList';
import Timeline from '../components/Timeline';
import { formatDate, formatTime } from '../utils/format';

// Shift start, incidents in time order, then the handover with open tasks.
function handoverTimeline(shift, tasks, incidents) {
  const openTasks = tasks.filter((t) => t.status !== 'Complete').length;
  const events = [...incidents]
    .sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at))
    .map((i) => ({
      id: `incident-${i.incident_id}`,
      when: formatTime(i.occurred_at),
      title: i.incident_type,
      detail: i.risk_level ? `${i.risk_level} risk · task ${i.task_status.toLowerCase()}` : 'Not predicted yet',
      tone: i.risk_level || 'muted',
      alert: i.risk_level === 'High',
      to: `/incidents/${i.incident_id}`,
    }));
  return [
    {
      id: 'start',
      when: formatTime(shift.start_time),
      title: 'Shift start',
      detail: `${shift.staff_count} staff · ${shift.department_name}`,
      tone: 'accent',
    },
    ...events,
    {
      id: 'handover',
      when: formatTime(shift.end_time),
      title: 'Handover',
      detail: openTasks
        ? `${openTasks} open task${openTasks === 1 ? '' : 's'} to carry over`
        : 'All tasks complete',
      tone: openTasks ? 'muted' : 'accent',
      alert: openTasks > 0,
    },
  ];
}

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
        <Link to="/shifts" className="link text-sm">Back to shifts</Link>
      </div>
    );
  }
  if (!data) return <p className="text-sm text-slate-500">Loading shift…</p>;

  const { shift, tasks, incidents } = data;
  const isOwner = shift.manager_id === manager.manager_id;

  return (
    <div className="space-y-6">
      <PageHeader
        back={<Link to="/shifts" className="link mb-2 inline-block text-sm">← All shifts</Link>}
        eyebrow={`${formatDate(shift.shift_date)} · ${shift.department_name}`}
        title={`${shift.shift_type} shift`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {formatTime(shift.start_time)}–{formatTime(shift.end_time)} · {shift.manager_name} · {shift.staff_count} staff
            </span>
            {!isOwner && (
              <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs text-slate-600">
                Read-only: this shift belongs to {shift.manager_name}
              </span>
            )}
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <IncidentList
            incidents={incidents}
            action={isOwner && !logging && (
              <button type="button" className="btn-dark px-4 py-1.5" onClick={() => setLogging(true)}>
                Log incident
              </button>
            )}
          >
            {logging && (
              <IncidentForm shift={shift} tasks={tasks} onLogged={load} onClose={() => setLogging(false)} />
            )}
          </IncidentList>
          <TaskList
            shiftId={shift.shift_id}
            tasks={tasks}
            canEdit={isOwner}
            onChange={(next) => setData((d) => ({ ...d, tasks: next }))}
          />
        </div>

        <aside className="min-w-0 space-y-6">
          <section className="card">
            <h2 className="section-title mb-4">Handover timeline</h2>
            <Timeline items={handoverTimeline(shift, tasks, incidents)} />
          </section>
          <ShiftNotes
            shift={shift}
            canEdit={isOwner}
            onSaved={(updated) => setData((d) => ({ ...d, shift: { ...d.shift, ...updated } }))}
          />
        </aside>
      </div>
    </div>
  );
}
