import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { apiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import { toast } from 'components/ui/sonner';
import { HandoverStatusBadge } from '../components/Badges';
import HandoverItems from '../components/HandoverItems';
import PageHeader from '../components/PageHeader';
import { formatDate, formatDateTime, formatTime } from '../utils/format';

const refreshNav = () => window.dispatchEvent(new Event('handovers:refresh'));

// One handover. The incoming person (or anyone in the shift's department) ticks items and
// acknowledges it once it has been submitted.
export default function HandoverDetailPage() {
  const { id } = useParams();
  const { manager } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setError('');
    api
      .get(`/handovers/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(apiError(err).message));
  }, [id]);

  useEffect(load, [load]);

  if (!data) {
    return error ? (
      <div className="space-y-3">
        <p className="alert-error" role="alert">{error}</p>
        <Link to="/handovers" className="link text-sm">Back to handovers</Link>
      </div>
    ) : <p className="text-sm text-slate-500">Loading handover…</p>;
  }

  const { handover, items } = data;
  const isSender = handover.from_manager_id === manager.manager_id;
  const canAcknowledge = handover.status === 'Submitted' && !isSender &&
    (handover.to_manager_id === manager.manager_id || handover.department_id === manager.department_id);
  const remaining = items.filter((i) => !i.acknowledged_at).length;

  async function acknowledgeItem(item) {
    setBusyId(item.item_id);
    setError('');
    try {
      const res = await api.post(`/handovers/${handover.handover_id}/items/${item.item_id}/acknowledge`);
      setData((d) => ({ ...d, items: d.items.map((i) => (i.item_id === item.item_id ? { ...i, ...res.data.item } : i)) }));
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setBusyId(null);
    }
  }

  async function acknowledgeAll() {
    setBusy(true);
    setError('');
    try {
      await api.post(`/handovers/${handover.handover_id}/acknowledge`);
      toast.success('Handover acknowledged');
      refreshNav();
      load();
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back={<Link to="/handovers" className="link mb-2 inline-block text-sm">← All handovers</Link>}
        eyebrow={`${formatDate(handover.shift_date)} · ${handover.department_name}`}
        title={`${handover.shift_type} shift handover`}
        subtitle={(
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {formatTime(handover.start_time)}–{formatTime(handover.end_time)} · From {handover.from_manager_name} to{' '}
              {handover.to_manager_name || `everyone in ${handover.department_name}`}
            </span>
            <HandoverStatusBadge status={handover.status} />
          </span>
        )}
        actions={<Link to={`/shifts/${handover.shift_id}`} className="btn-secondary">Open shift</Link>}
      />

      {error && <p className="alert-error" role="alert">{error}</p>}

      {handover.status === 'Draft' ? (
        <section className="card space-y-2">
          <p className="text-sm text-slate-600">
            {isSender
              ? 'This handover is still a draft. Finish and submit it from the shift page.'
              : `${handover.from_manager_name} is still preparing this handover.`}
          </p>
          {isSender && <Link to={`/shifts/${handover.shift_id}`} className="link text-sm">Go to the shift</Link>}
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="card min-w-0 lg:col-span-2">
            <h2 className="section-title mb-4">
              Items{' '}
              {canAcknowledge && <span className="text-sm font-normal text-slate-500">({remaining} to tick)</span>}
            </h2>
            <HandoverItems items={items} onAcknowledge={canAcknowledge ? acknowledgeItem : undefined} busyId={busyId} />
          </section>

          <aside className="min-w-0 space-y-6">
            <section className="card space-y-2">
              <h2 className="section-title">Summary</h2>
              <p className="whitespace-pre-line text-sm text-slate-700">{handover.summary}</p>
              <p className="text-xs text-slate-500">Submitted {formatDateTime(handover.submitted_at)}</p>
            </section>

            <section className="card space-y-3">
              <h2 className="section-title">Acknowledgement</h2>
              {handover.status === 'Acknowledged' ? (
                <p className="text-sm text-slate-700">Acknowledged {formatDateTime(handover.acknowledged_at)}.</p>
              ) : canAcknowledge ? (
                <>
                  <p className="text-sm text-slate-600">
                    {remaining > 0
                      ? `${remaining} item${remaining === 1 ? '' : 's'} not ticked yet. Acknowledging also ticks them.`
                      : 'All items ticked.'}
                  </p>
                  <button type="button" className="btn-primary" onClick={acknowledgeAll} disabled={busy}>
                    {busy ? 'Acknowledging…' : 'Acknowledge handover'}
                  </button>
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  {isSender ? 'Waiting for the incoming person to acknowledge.' : 'Only the incoming person or their department can acknowledge.'}
                </p>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
