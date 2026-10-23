import { Link } from 'react-router-dom';
import { formatDateTime } from '../utils/format';
import { RiskBadge } from './Badges';

const RISK_ORDER = { High: 0, Medium: 1, Low: 2 };

// Incidents on a shift, highest predicted risk first.
export default function IncidentList({ incidents, action, children }) {
  const sorted = [...incidents].sort(
    (a, b) => (RISK_ORDER[a.risk_level] ?? 3) - (RISK_ORDER[b.risk_level] ?? 3)
  );

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title">
          Incidents <span className="text-sm font-normal normal-case tracking-normal text-slate-500">({incidents.length})</span>
        </h2>
        {action}
      </div>
      {children && <div className="mt-3">{children}</div>}

      {sorted.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No incidents logged on this shift.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sorted.map((i) => (
            <li key={i.incident_id}>
              <Link to={`/incidents/${i.incident_id}`} className="tile flex flex-wrap items-start justify-between gap-3 transition hover:ring-accent-300">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{i.incident_type}</p>
                  <p className="text-sm text-slate-600">{i.description}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDateTime(i.occurred_at)} · task {i.task_status.toLowerCase()}
                  </p>
                </div>
                <RiskBadge level={i.risk_level} confidence={i.confidence} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
