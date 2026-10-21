
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BookOpenText,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, roles: ['admin', 'faculty'] },
  { to: '/work', label: 'Daily work', icon: ClipboardCheck, roles: ['admin', 'faculty'] },
  { to: '/books', label: 'Book reviews', icon: BookOpenText, roles: ['admin', 'faculty'] },
  { to: '/team', label: 'Faculty accounts', icon: Users, roles: ['admin'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const heading =
    navItems.find((item) => item.to === location.pathname)?.label ||
    'Book review';

  return (
    <div className="min-h-screen bg-paper md:flex">
      <aside className="flex w-full flex-col border-b border-slate-200 bg-white md:fixed md:inset-y-0 md:w-64 md:border-b-0 md:border-r">

        {/* Click the logo or name to return to Overview */}
        <NavLink
          to="/"
          end
          aria-label="Akshar Paaul home"
          className="mx-2 flex items-center gap-3 rounded-xl px-3 py-5 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest md:mx-2 md:px-4 md:py-5"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest text-white">
            <GraduationCap size={23} />
          </div>

          <div>
            <p className="font-extrabold tracking-tight text-slate-900">
              Akshar Paaul
            </p>
            <p className="text-xs text-slate-500">
              Learning support portal
            </p>
          </div>
        </NavLink>

        <div className="hidden px-6 pb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 md:block">
          Workspace
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:px-3">
          {navItems
            .filter((item) => item.roles.includes(user?.role))
            .map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                      isActive
                        ? 'bg-forest/10 text-forest'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`
                  }
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
        </nav>

        {/* Desktop account section */}
        <div className="mt-auto hidden border-t border-slate-100 p-4 md:block">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-paper p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sun font-bold text-slate-800">
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{user?.name}</p>
              <p className="text-xs capitalize text-slate-500">
                {user?.role}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>

        {/* Mobile account section */}
        <div className="flex items-center justify-between px-4 pb-3 md:hidden">
          <span className="text-xs text-slate-500">
            {user?.name} ·{' '}
            <span className="capitalize">{user?.role}</span>
          </span>

          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1 text-xs font-semibold text-slate-500"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-10 pt-5 sm:px-6 lg:px-10 md:ml-64 md:pt-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-7 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-forest">
                Akshar Paaul · {user?.role}
              </p>

              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                {heading}
              </h1>
            </div>

            <div className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-500 sm:block">
              Simple tools for everyday learning
            </div>
          </header>

          <Outlet />
        </div>
      </main>
    </div>
  );
}
