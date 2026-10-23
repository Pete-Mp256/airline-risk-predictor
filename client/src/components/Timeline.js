import { Link } from 'react-router-dom';
import { AlertIcon, CheckIcon } from './Icons';

const TONES = {
  accent: 'bg-accent-500 text-white',
  muted: 'bg-slate-300 text-white',
  Low: 'bg-emerald-500 text-white',
  Medium: 'bg-amber-500 text-white',
  High: 'bg-red-600 text-white',
};

// Vertical timeline with check circles joined by a line (the "itinerary preview" look).
// items: [{ id, when, title, detail, tone, alert, to }]
export default function Timeline({ items, empty = 'Nothing yet.' }) {
  if (items.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;

  return (
    <ol className="relative">
      {items.map((item, index) => {
        const last = index === items.length - 1;
        const body = (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-800">
              {item.when && <span>{item.when} – </span>}
              {item.title}
            </p>
            {item.detail && <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>}
          </>
        );
        return (
          <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!last && <span className="absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-0.5 bg-accent-200" aria-hidden="true" />}
            <span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${TONES[item.tone] || TONES.accent}`}>
              {item.alert ? <AlertIcon className="h-3.5 w-3.5" /> : <CheckIcon className="h-3.5 w-3.5" />}
            </span>
            <div className="min-w-0 pt-0.5">
              {item.to ? <Link to={item.to} className="block rounded-md hover:bg-white/70">{body}</Link> : body}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
