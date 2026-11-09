import { Link } from 'react-router-dom';
import { formatDateTime } from '../utils/format';
import { RiskBadge, StatusBadge } from './Badges';

const GROUPS = [
  ['Open task', 'Open tasks', 'No open tasks: everything on this shift is complete.'],
  ['Incident', 'Incidents', 'No incidents logged on this shift.'],
  ['Note', 'Notes', 'No notes.'],
];

function ItemBody({ item }) {
  if (item.item_type === 'Open task') {
    return (
      <div className="min-w-0 flex-1">
        <p className="font-medium">{item.task_title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {item.aircraft_reg && <span>{item.aircraft_reg}</span>}
          <StatusBadge status={item.task_status} />
          {item.carried_over && <span className="font-medium text-accent-700">Carried over</span>}
        </p>
      </div>
    );
  }
  if (item.item_type === 'Incident') {
    return (
      <div className="min-w-0 flex-1">
        <Link to={`/incidents/${item.incident_id}`} className="link">{item.incident_type}</Link>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>{formatDateTime(item.occurred_at)}</span>
          <RiskBadge level={item.final_risk_level} />
        </p>
      </div>
    );
  }
  return <p className="min-w-0 flex-1 whitespace-pre-line text-sm text-slate-700">{item.note}</p>;
}

// A handover's items grouped as open tasks, incidents and notes.
// onRemove(item): shows Remove on notes (Draft). onAcknowledge(item): shows a tick box per item.
export default function HandoverItems({ items, onRemove, onAcknowledge, busyId }) {
  return (
    <div className="space-y-4">
      {GROUPS.map(([type, heading, empty]) => {
        const group = items.filter((i) => i.item_type === type);
        if (type === 'Note' && group.length === 0 && !onRemove) return null;
        return (
          <div key={type}>
            <h3 className="label mb-2">{heading} ({group.length})</h3>
            {group.length === 0 ? (
              <p className="text-sm text-slate-500">{empty}</p>
            ) : (
              <ul className="space-y-2">
                {group.map((item) => {
                  const acked = Boolean(item.acknowledged_at);
                  return (
                    <li key={item.item_id} className="tile flex items-start gap-3">
                      {onAcknowledge && (
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 shrink-0 accent-accent-600"
                          checked={acked}
                          disabled={acked || busyId === item.item_id}
                          onChange={() => onAcknowledge(item)}
                          aria-label={`Acknowledge ${item.task_title || item.incident_type || 'note'}`}
                        />
                      )}
                      <ItemBody item={item} />
                      {acked && !onAcknowledge && (
                        <span className="shrink-0 text-xs font-medium text-risk-low-ink">Acknowledged</span>
                      )}
                      {onRemove && type === 'Note' && (
                        <button type="button" className="shrink-0 text-xs font-medium text-slate-500 hover:text-accent-700"
                          disabled={busyId === item.item_id} onClick={() => onRemove(item)}>
                          Remove
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
