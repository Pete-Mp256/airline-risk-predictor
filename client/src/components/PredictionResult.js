import { describeFeature } from '../utils/features';
import { RiskBadge } from './Badges';

const BAR_COLOURS = { Low: 'bg-emerald-500', Medium: 'bg-amber-500', High: 'bg-red-600' };
const LEVELS = ['Low', 'Medium', 'High'];

const SUMMARY = {
  High: 'Treat as a priority at handover and brief the incoming shift.',
  Medium: 'Monitor and include in the handover notes.',
  Low: 'Routine: record and continue.',
};

// Risk badge, class probabilities and the top SHAP reasons in plain words.
export default function PredictionResult({ prediction }) {
  const probabilities = prediction.probabilities || {};
  const factors = (prediction.top_factors || []).slice(0, 3);
  const threshold = prediction.high_threshold;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <RiskBadge level={prediction.risk_level} confidence={prediction.confidence} size="lg" />
        <p className="text-sm text-slate-600">{SUMMARY[prediction.risk_level]}</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">Why the model said this</h3>
        {factors.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">No explanation available.</p>
        ) : (
          <ol className="mt-2 space-y-2">
            {factors.map((f, index) => {
              const raises = f.effect === 'raises';
              return (
                <li key={f.feature} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                    {index + 1}
                  </span>
                  <span>
                    <span className="font-medium">{describeFeature(f.feature, f.value)}</span>{' '}
                    <span className={raises ? 'text-red-700' : 'text-emerald-700'}>
                      {raises ? '↑ raised' : '↓ lowered'}
                    </span>{' '}
                    the {prediction.risk_level} risk score.
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">Probability of each level</h3>
        <dl className="mt-2 space-y-1.5">
          {LEVELS.map((level) => {
            const p = Number(probabilities[level] || 0);
            return (
              <div key={level} className="flex items-center gap-3 text-sm">
                <dt className="w-16 text-slate-600">{level}</dt>
                <dd className="flex flex-1 items-center gap-2">
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span className={`block h-full rounded-full ${BAR_COLOURS[level]}`} style={{ width: `${p * 100}%` }} />
                  </span>
                  <span className="w-12 text-right tabular-nums text-slate-700">{Math.round(p * 100)}%</span>
                </dd>
              </div>
            );
          })}
        </dl>
        {threshold != null && (
          <p className="mt-2 text-xs text-slate-500">
            The model flags High when the High probability is {Math.round(threshold * 1000) / 10}% or more.
          </p>
        )}
      </div>
    </div>
  );
}
