// Module 2: how the handover checks changed a prediction. risk_level is the model rating,
// final_risk_level the rating after the checks, handover_flags the checks that fired.

// "Model: Medium → Final: High (weak handover)".
export function RatingChange({ prediction, className = 'text-sm text-slate-600' }) {
  if (!prediction.risk_level) return null;
  const finalLevel = prediction.final_risk_level || prediction.risk_level;
  const raised = finalLevel !== prediction.risk_level;
  const note = prediction.handover_level === 'Weak' ? 'weak handover' : prediction.handover_level === 'OK' ? 'handover OK' : null;
  return (
    <p className={className}>
      Model: <span className="font-medium">{prediction.risk_level}</span> → Final:{' '}
      <span className={raised ? 'font-semibold text-risk-high-ink' : 'font-medium'}>{finalLevel}</span>
      {note && ` (${note})`}
    </p>
  );
}

// The handover checks that fired, in plain words.
export function FlagList({ flags, className = 'list-disc space-y-1 pl-5 text-sm text-slate-700' }) {
  if (!flags || flags.length === 0) return null;
  return (
    <ul className={className}>
      {flags.map((f) => <li key={f.code}>{f.label}</li>)}
    </ul>
  );
}
