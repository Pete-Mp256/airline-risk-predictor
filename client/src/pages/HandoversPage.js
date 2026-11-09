import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { apiError } from '../api';
import { HandoverStatusBadge } from '../components/Badges';
import PageHeader from '../components/PageHeader';
import { formatDate, formatDateTime } from '../utils/format';

const TABS = [
  { box: 'incoming', label: 'Incoming', empty: 'No handovers sent to you or your department yet.' },
  { box: 'sent', label: 'Sent', empty: 'You have not started any handovers. Start one from a shift page.' },
];

// Incoming handovers to acknowledge, and the ones I sent.
export default function HandoversPage() {
  const [params, setParams] = useSearchParams();
  const box = params.get('box') === 'sent' ? 'sent' : 'incoming';
  const [handovers, setHandovers] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setHandovers(null);
    setError('');
    api
      .get('/handovers', { params: { box } })
      .then((res) => setHandovers(res.data.handovers))
      .catch((err) => setError(apiError(err).message));
  }, [box]);

  const tab = TABS.find((t) => t.box === box);
  const waiting = box === 'incoming' && handovers ? handovers.filter((h) => h.status === 'Submitted').length : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Handovers"
        subtitle="Tick off what you have taken over, then acknowledge the handover."
        actions={(
          <div className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-slate-200" role="tablist" aria-label="Handovers">
            {TABS.map((t) => (
              <button key={t.box} type="button" role="tab" aria-selected={box === t.box}
                className={box === t.box ? 'pill-active' : 'pill'} onClick={() => setParams({ box: t.box })}>
                {t.label}
              </button>
            ))}
          </div>
        )}
      />

      {error && <p className="alert-error" role="alert">{error}</p>}

      <section className="card">
        <h2 className="section-title">
          {tab.label}{' '}
          <span className="text-sm font-normal text-slate-500">
            {handovers && (box === 'incoming' ? `(${waiting} waiting)` : `(${handovers.length})`)}
          </span>
        </h2>
        {!handovers ? (
          !error && <p className="mt-3 text-sm text-slate-500">Loading handovers…</p>
        ) : handovers.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">{tab.empty}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {handovers.map((h) => (
              <li key={h.handover_id}>
                <Link to={`/handovers/${h.handover_id}`}
                  className="tile flex flex-wrap items-start justify-between gap-3 transition hover:ring-accent-300">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{h.shift_type} shift · {formatDate(h.shift_date)}</p>
                    <p className="text-sm text-slate-600">
                      {box === 'incoming'
                        ? `From ${h.from_manager_name}`
                        : `To ${h.to_manager_name || `everyone in ${h.department_name}`}`} · {h.department_name}
                    </p>
                    {h.summary && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{h.summary}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <HandoverStatusBadge status={h.status} />
                    <span className="text-xs text-slate-500">
                      {h.submitted_at ? `Submitted ${formatDateTime(h.submitted_at)}` : `Started ${formatDateTime(h.created_at)}`}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
