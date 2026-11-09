import { Fragment, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { CalendarClock, ChevronRight, LayoutDashboard, Menu } from 'lucide-react';
import { cn } from 'lib/utils';
import { Button } from 'components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from 'components/ui/sheet';
import Logo from './Logo';
import NotificationBell from './NotificationBell';
import ProfileMenu from './ProfileMenu';

const NAV = [
  { to: '/shifts', label: 'Shifts', icon: CalendarClock, hint: 'Handovers, tasks and incidents' },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, hint: 'Risk trends and summaries' },
];

// Breadcrumb trail for the top bar, from the current path.
function crumbsFor(pathname) {
  if (pathname.startsWith('/shifts/')) return [{ to: '/shifts', label: 'Shifts' }, { label: 'Shift handover' }];
  if (pathname.startsWith('/incidents/')) return [{ to: '/shifts', label: 'Shifts' }, { label: 'Incident' }];
  const item = NAV.find((n) => pathname.startsWith(n.to));
  return [{ label: item ? item.label : 'Page not found' }];
}

function NavItems() {
  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Workspace</p>
      {NAV.map(({ to, label, icon: Icon, hint }) => {
        return (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-accent-50 font-medium text-accent-800 before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-accent-600'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('h-[18px] w-[18px]', isActive ? 'text-accent-600' : 'text-slate-400 group-hover:text-slate-600')} />
                <span className="flex flex-col leading-tight">
                  {label}
                  <span className="text-[11px] font-normal text-slate-400">{hint}</span>
                </span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

function SidebarBody() {
  return (
    <>
      <div className="livery" aria-hidden="true" />
      <div className="px-5 pb-4 pt-5">
        <Link to="/shifts" aria-label="Incident Risk home"><Logo /></Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <NavItems />
      </div>
      <div className="border-t p-3">
        <ProfileMenu variant="full" />
      </div>
    </>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  const crumbs = crumbsFor(pathname);
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu after navigating.
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r bg-slate-50/70 lg:flex">
        <SidebarBody />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-white/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/70 sm:px-6 lg:px-8">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" aria-label="Open menu">
                <Menu className="!size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SheetDescription className="sr-only">Main navigation</SheetDescription>
              <SidebarBody />
            </SheetContent>
          </Sheet>

          <Link to="/shifts" className="lg:hidden" aria-label="Incident Risk home"><Logo /></Link>

          <ol className="hidden items-center gap-1.5 text-sm lg:flex" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <Fragment key={c.label}>
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />}
                <li>
                  {c.to ? (
                    <Link to={c.to} className="text-slate-500 transition-colors hover:text-ink">{c.label}</Link>
                  ) : (
                    <span className="font-medium text-ink" aria-current="page">{c.label}</span>
                  )}
                </li>
              </Fragment>
            ))}
          </ol>

          <div className="ml-auto flex items-center gap-1.5">
            <NotificationBell />
            <div className="lg:hidden">
              <ProfileMenu />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
