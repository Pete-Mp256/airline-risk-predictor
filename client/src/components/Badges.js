const RISK_STYLES = {
  Low: 'bg-emerald-50 text-emerald-800 ring-emerald-600/30',
  Medium: 'bg-amber-50 text-amber-800 ring-amber-600/30',
  High: 'bg-red-50 text-red-800 ring-red-600/30',
};

const STATUS_STYLES = {
  Pending: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  'In Progress': 'bg-accent-50 text-accent-800 ring-accent-600/30',
  Complete: 'bg-emerald-50 text-emerald-800 ring-emerald-600/30',
};

const BASE = 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset';

// Risk level with a text label (not colour alone). Shows "Not predicted" when missing.
export function RiskBadge({ level, confidence, size = 'sm' }) {
  if (!level) {
    return <span className={`${BASE} bg-white text-slate-500 ring-slate-300`}>Not predicted</span>;
  }
  const large = size === 'lg' ? 'px-3 py-1 text-sm' : '';
  return (
    <span className={`${BASE} ${RISK_STYLES[level]} ${large}`}>
      <span className="font-semibold">{level} risk</span>
      {confidence != null && <span>· {Math.round(Number(confidence) * 100)}%</span>}
    </span>
  );
}

export function StatusBadge({ status }) {
  return <span className={`${BASE} ${STATUS_STYLES[status] || STATUS_STYLES.Pending}`}>{status}</span>;
}
