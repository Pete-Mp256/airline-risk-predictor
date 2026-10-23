import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { apiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import { RiskBadge } from '../components/Badges';
import PredictionResult from '../components/PredictionResult';
import RetryPrediction from '../components/RetryPrediction';
import { NUMERIC_FEATURES } from '../utils/features';
import { formatDate, formatDateTime } from '../utils/format';

export default function IncidentDetailPage() {
  const { id } = useParams();
  const { manager } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api
      .get(`/incidents/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(apiError(err).message));
  }, [id]);

  useEffect(load, [load]);

  if (error) {
    return (
      <div className="space-y-3">
        <p className="alert-error" role="alert">{error}</p>
        <Link to="/shifts" className="text-sm text-accent-700 hover:underline">Back to shifts</Link>
      </div>
    );
  }
  if (!data) return <p className="text-sm text-slate-500">Loading incident…</p>;

  const { incident, predictions } = data;
  const latest = predictions[0];
  const isOwner = incident.shift_manager_id === manager.manager_id;

  const details = [
    ['Occurred', formatDateTime(incident.occurred_at)],
    ['Shift', `${incident.shift_type} · ${formatDate(incident.shift_date)} · ${incident.department_name}`],
    ['Task', incident.task_title || 'None'],
    ['Task status', incident.task_status],
    ['Reported severity', incident.reported_severity || 'Not given'],
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/shifts/${incident.shift_id}`} className="link text-sm">← Back to shift</Link>
        <p className="mt-2 text-xs text-slate-500">
          {formatDateTime(incident.occurred_at)} · {incident.shift_type} shift · {incident.department_name}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="page-title">{incident.incident_type}</h1>
          <RiskBadge level={latest?.risk_level} confidence={latest?.confidence} />
        </div>
        <p className="mt-1 text-sm text-slate-600">{incident.description}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="section-title">Risk prediction</h2>
          <div className="mt-3">
            {latest ? (
              <PredictionResult prediction={latest} />
            ) : (
              <RetryPrediction incidentId={incident.incident_id} canRetry={isOwner} onPredicted={load} />
            )}
          </div>
        </section>

        <section className="card space-y-4">
          <h2 className="section-title">Details</h2>
          <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
            {details.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-slate-500">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Model readings</h3>
            <dl className="mt-1.5 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
              {NUMERIC_FEATURES.map((f) => (
                <div key={f.name} className="contents">
                  <dt className="text-slate-500">{f.label}</dt>
                  <dd className="tabular-nums">{incident[f.name]} {f.unit !== '0–1' && f.unit}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </div>

      {predictions.length > 0 && (
        <section className="card">
          <h2 className="section-title">Prediction history</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Risk</th>
                  <th className="py-2 pr-4">Model</th>
                  <th className="py-2 pr-4 text-right">Threshold</th>
                  <th className="py-2 text-right">Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {predictions.map((p) => (
                  <tr key={p.prediction_id}>
                    <td className="py-2 pr-4">{formatDateTime(p.created_at)}</td>
                    <td className="py-2 pr-4"><RiskBadge level={p.risk_level} confidence={p.confidence} /></td>
                    <td className="py-2 pr-4">{p.model_version || '—'}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{p.high_threshold ?? '—'}</td>
                    <td className="py-2 text-right tabular-nums">{p.response_ms != null ? `${p.response_ms} ms` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
