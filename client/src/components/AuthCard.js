import { PlaneIllustration } from './Icons';
import { Logo } from './Layout';

// Centred card used by the login and register pages.
export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="shell w-full max-w-md">
        <div className="livery" aria-hidden="true" />
        <div className="px-6 py-8 sm:px-8">
          <Logo />
          <PlaneIllustration className="mx-auto mt-4 h-20 w-auto -rotate-6 drop-shadow-md" />
          <h1 className="page-title mt-4 text-2xl sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <p className="mt-6 text-center text-sm text-slate-600">{footer}</p>}
        </div>
      </div>
    </div>
  );
}
