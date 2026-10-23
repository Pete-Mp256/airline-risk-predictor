import { PlaneIllustration } from './Icons';

function todayLine() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// Small grey date line, large light uppercase title, optional subtitle, actions and plane.
export default function PageHeader({ eyebrow, title, subtitle, actions, back, plane = false }) {
  return (
    <div className="relative flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back}
        <p className="text-xs text-slate-500">{eyebrow ?? todayLine()}</p>
        <h1 className="page-title mt-1">{title}</h1>
        {subtitle && <div className="mt-2 text-sm text-slate-600">{subtitle}</div>}
      </div>
      {plane && (
        <PlaneIllustration className="pointer-events-none hidden h-28 w-auto -rotate-6 drop-shadow-lg md:block lg:h-32" />
      )}
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
