import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { RiskBadge } from './Badges';
import FlyingPlane from './FlyingPlane';
import { PlaneIcon } from './Icons';
import Reveal from './Reveal';
import ThemeToggle from './ThemeToggle';

const POINTS = [
  'Low, Medium or High risk on every incident',
  'The top three readings behind each rating',
  'Alerts and handover summaries sent on their own',
];

// Split layout for the login and register pages: the form on the left, a picture and short
// explanation on the right (large screens only).
export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen bg-white dark:bg-black">
      {/* Form */}
      <div className="relative flex min-h-screen w-full flex-col px-5 py-5 sm:px-10 lg:w-1/2">
        <div className="flex items-center justify-between">
          <Link to="/" className="nav-pill gap-2 pl-1.5 pr-4 font-semibold tracking-tight text-ink dark:text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-600 text-white">
              <PlaneIcon className="h-4 w-4" />
            </span>
            <span className="text-[15px]">Incident Risk</span>
          </Link>
          <ThemeToggle />
        </div>

        <FlyingPlane top="4.5rem" duration={20} size="h-8" className="lg:hidden" />

        <div className="flex flex-1 items-center justify-center py-12">
          <Reveal className="w-full max-w-sm">
            <h1 className="text-4xl font-bold tracking-[-0.03em] text-ink dark:text-white">{title}</h1>
            {subtitle && <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-neutral-400">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && <p className="mt-8 text-center text-sm text-slate-500 dark:text-neutral-400">{footer}</p>}
          </Reveal>
        </div>
      </div>

      {/* Picture and explanation */}
      <aside className="hidden p-3 lg:block lg:w-1/2">
        <div className="panel sticky top-3 flex h-[calc(100vh-1.5rem)] flex-col justify-between bg-black p-10 text-white ring-0 dark:bg-[#0b0b0b] dark:ring-1">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -bottom-32 -left-20 h-96 w-[80%] rounded-full bg-accent-600/60 blur-[120px]" />
            <div className="absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-accent-500/30 blur-[100px]" />
          </div>
          <PlaneIcon aria-hidden="true" strokeWidth="0.6"
            className="pointer-events-none absolute -right-24 top-10 h-[34rem] w-[34rem] -rotate-12 text-white/[0.05]" />
          <FlyingPlane top="18%" duration={14} size="h-16" />

          <span className="eyebrow relative self-start bg-white/10 text-white/70 ring-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-500" /> Shift handover
          </span>

          <div className="relative">
            <h2 className="max-w-md text-4xl font-bold leading-[1.05] tracking-[-0.03em] xl:text-5xl">
              Hand over with the risks already ranked.
            </h2>
            <ul className="mt-8 space-y-3">
              {POINTS.map((point) => (
                <li key={point} className="flex items-center gap-3 text-white/80">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  {point}
                </li>
              ))}
            </ul>

            <div className="mt-10 max-w-sm rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10 backdrop-blur-md">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-white/50">Night shift · Base Maintenance</p>
                  <p className="mt-0.5 text-sm font-semibold">Hardware fault on a pending task</p>
                </div>
                <RiskBadge level="High" confidence={0.92} />
              </div>
              <p className="mt-3 border-t border-white/10 pt-3 text-xs text-white/60">
                Raised by severity score 0.95 and tool wear of 210 minutes.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
