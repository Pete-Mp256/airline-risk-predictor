import { Link, NavLink } from 'react-router-dom';
import { PlaneIcon } from './Icons';
import ThemeToggle from './ThemeToggle';

// Floating pill navbar for the public pages: logo, section links, theme toggle, log in and sign up.
// `links` are in-page anchors (landing page only).
export default function PublicNavbar({ links = [] }) {
  return (
    <header className="fixed inset-x-0 top-3 z-50 px-3 sm:top-4">
      <nav aria-label="Main" className="mx-auto flex max-w-5xl items-center justify-between gap-2">
        <Link to="/" className="nav-pill gap-2 pl-1.5 pr-4 font-semibold tracking-tight text-ink dark:text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-600 text-white">
            <PlaneIcon className="h-4 w-4" />
          </span>
          <span className="hidden text-[15px] sm:inline">Incident Risk</span>
        </Link>

        {links.length > 0 && (
          <div className="nav-pill hidden px-2 md:flex">
            {links.map((link, i) => (
              <span key={link.href} className="flex items-center">
                {i > 0 && <span className="h-4 w-px bg-black/10 dark:bg-white/15" aria-hidden="true" />}
                <a href={link.href}
                  className="rounded-full px-3.5 py-1.5 text-sm text-slate-600 transition-colors hover:text-black dark:text-neutral-400 dark:hover:text-white">
                  {link.label}
                </a>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="nav-pill gap-1">
            <NavLink to="/login"
              className={({ isActive }) => `rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${isActive
                ? 'text-black dark:text-white'
                : 'text-slate-600 hover:text-black dark:text-neutral-400 dark:hover:text-white'}`}>
              Log in
            </NavLink>
            <Link to="/register"
              className="rounded-full bg-accent-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700">
              Sign up
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
