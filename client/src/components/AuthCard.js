import { PlaneIcon, PlaneIllustration } from './Icons';

// Centred card used by the login and register pages.
export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="shell w-full max-w-md px-6 py-8 sm:px-8">
        <div className="flex items-center gap-2 text-slate-900">
          <PlaneIcon className="h-6 w-6" />
          <span className="text-lg font-medium uppercase tracking-[0.08em]">Incident Risk</span>
        </div>
        <PlaneIllustration className="mx-auto mt-4 h-20 w-auto -rotate-6 drop-shadow-md" />
        <h1 className="page-title mt-4 text-2xl sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        {footer && <p className="mt-6 text-center text-sm text-slate-600">{footer}</p>}
      </div>
    </div>
  );
}
