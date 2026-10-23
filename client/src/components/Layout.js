import { Link, NavLink, Outlet } from 'react-router-dom';
import { PlaneIcon } from './Icons';
import NotificationBell from './NotificationBell';
import ProfileMenu from './ProfileMenu';

const NAV = [
  { to: '/shifts', label: 'Shifts' },
  { to: '/dashboard', label: 'Dashboard' },
];

export function Logo() {
  return (
    <span className="flex items-center gap-2 text-slate-900">
      <PlaneIcon className="h-6 w-6" />
      <span className="text-lg font-medium uppercase tracking-[0.08em]">Incident Risk</span>
    </span>
  );
}

export default function Layout() {
  return (
    <div className="px-3 py-4 sm:px-6 sm:py-8">
      <div className="shell">
        <header className="flex flex-wrap items-center gap-3 px-5 pt-5 sm:px-8 sm:pt-7">
          <Link to="/shifts" aria-label="Incident Risk home"><Logo /></Link>
          <nav className="order-last flex w-full justify-center sm:order-none sm:ml-auto sm:w-auto" aria-label="Main">
            <div className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-slate-200">
              {NAV.map((item) => (
                <NavLink key={item.to} to={item.to}
                  className={({ isActive }) => (isActive ? 'pill-active' : 'pill')}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <ProfileMenu />
          </div>
        </header>
        <main className="px-5 pb-8 pt-6 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
