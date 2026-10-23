import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import NotificationBell from './NotificationBell';

const linkClass = ({ isActive }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-sky-50 text-sky-800' : 'text-slate-600 hover:bg-slate-100'
  }`;

export default function Layout() {
  const { manager, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <span className="mr-4 font-semibold text-sky-800">Incident Risk Predictor</span>
          <nav className="flex gap-1">
            <NavLink to="/shifts" className={linkClass}>Shifts</NavLink>
            <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <span className="hidden text-sm text-slate-600 sm:inline">
              {manager.first_name} {manager.last_name}
            </span>
            <button type="button" onClick={logout} className="btn-secondary px-3 py-1.5">
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
