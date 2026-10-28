import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/**
 * Application shell — CHROME ONLY.
 * Renders the header navigation (responsive, with a hamburger menu on small
 * screens), the signed-in user's name and a Logout button.
 * It deliberately does NOT render <Outlet /> or children: the routing file
 * renders the outlet beside this component.
 */

type Role = 'member' | 'librarian';

interface ShellUser {
  name?: string;
  role?: Role | string;
}

interface NavItem {
  to: string;
  label: string;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/catalogue', label: 'Catalogue', roles: ['member', 'librarian'] },
  { to: '/my-loans', label: 'My Loans', roles: ['member'] },
  { to: '/manage-books', label: 'Manage Books', roles: ['librarian'] },
  { to: '/borrowed-books', label: 'Borrowed Books', roles: ['librarian'] },
];

function linkClass({ isActive }: { isActive: boolean }): string {
  return [
    'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-indigo-700 text-white'
      : 'text-indigo-100 hover:bg-indigo-500 hover:text-white',
  ].join(' ');
}

export default function Layout() {
  // useAuth exposes { token, user }; a logout function may or may not be present.
  const auth = useAuth() as {
    token: string | null;
    user: ShellUser | null;
    logout?: () => void;
  };
  const { token, user } = auth;
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const role = (user?.role ?? '') as Role;
  const visibleItems = token && user ? NAV_ITEMS.filter((item) => item.roles.includes(role)) : [];
  const isSignedIn = Boolean(token && user);

  const handleLogout = () => {
    setMenuOpen(false);
    if (typeof auth.logout === 'function') {
      // Context-owned sign-out clears both the stored token and the context state.
      auth.logout();
      navigate('/login', { replace: true });
      return;
    }
    // Fallback: remove the stored token and reload so the AuthContext
    // re-initialises from (now empty) storage and route guards see no user.
    try {
      window.localStorage.clear();
    } catch {
      /* storage unavailable — reload still resets in-memory state */
    }
    window.location.assign('/login');
  };

  return (
    <header className="bg-indigo-600 shadow">
      <nav className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <NavLink
              to="/catalogue"
              className="text-lg font-bold tracking-tight text-white"
              onClick={() => setMenuOpen(false)}
            >
              Library Portal
            </NavLink>
            <div className="hidden md:flex md:items-center md:gap-1">
              {visibleItems.map((item) => (
                <NavLink key={item.to} to={item.to} className={linkClass}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>

          <div className="hidden md:flex md:items-center md:gap-4">
            {isSignedIn && (
              <>
                <span className="text-sm text-indigo-100">
                  {user?.name ?? 'Signed in'}
                  {user?.role ? (
                    <span className="ml-2 rounded bg-indigo-800 px-2 py-0.5 text-xs uppercase text-indigo-100">
                      {user.role}
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
                >
                  Logout
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-indigo-100 hover:bg-indigo-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-white md:hidden"
            aria-controls="mobile-menu"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div id="mobile-menu" className="border-t border-indigo-500 md:hidden">
          <div className="space-y-1 px-4 py-3">
            {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={linkClass}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
          {isSignedIn && (
            <div className="flex items-center justify-between border-t border-indigo-500 px-4 py-3">
              <span className="text-sm text-indigo-100">{user?.name ?? 'Signed in'}</span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}