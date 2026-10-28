import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

interface NavItem {
  to: string;
  label: string;
}

const memberLinks: NavItem[] = [
  { to: '/catalogue', label: 'Catalogue' },
  { to: '/my-loans', label: 'My Loans' },
];

const librarianLinks: NavItem[] = [
  { to: '/catalogue', label: 'Catalogue' },
  { to: '/manage-books', label: 'Manage Books' },
  { to: '/borrowed-books', label: 'Borrowed Books' },
];

/**
 * Application shell chrome: top navigation bar only.
 * The routing layout renders the page outlet beside this component.
 */
export default function Layout() {
  // The auth context shape is consumed defensively: user { name, role } and logout().
  const auth = useAuth() as unknown as {
    user?: { name?: string; role?: string } | null;
    logout?: () => void | Promise<void>;
  };
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const user = auth?.user ?? null;
  const role = user?.role;
  const links: NavItem[] = role === 'librarian' ? librarianLinks : role === 'member' ? memberLinks : [];
  const canLogout = typeof auth?.logout === 'function';

  const handleLogout = async () => {
    setMenuOpen(false);
    if (canLogout) {
      await auth.logout!();
    }
    navigate('/login', { replace: true });
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? 'bg-indigo-700 text-white' : 'text-indigo-100 hover:bg-indigo-500 hover:text-white'
    }`;

  return (
    <header className="bg-indigo-600 shadow">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <NavLink to="/catalogue" className="text-lg font-bold text-white" onClick={() => setMenuOpen(false)}>
              Library Portal
            </NavLink>
            <div className="hidden md:flex md:items-center md:gap-2">
              {links.map((link) => (
                <NavLink key={link.to} to={link.to} className={linkClass}>
                  {link.label}
                </NavLink>
              ))}
            </div>
          </div>

          <div className="hidden md:flex md:items-center md:gap-4">
            {user && (
              <span className="text-sm text-indigo-100">
                {user.name ?? 'User'}
                {role && <span className="ml-2 rounded bg-indigo-800 px-2 py-0.5 text-xs uppercase">{role}</span>}
              </span>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
            >
              Logout
            </button>
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-indigo-100 hover:bg-indigo-500 hover:text-white md:hidden"
            aria-controls="mobile-menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="sr-only">{menuOpen ? 'Close main menu' : 'Open main menu'}</span>
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
          <div className="space-y-1 px-2 pb-3 pt-2">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className={linkClass} onClick={() => setMenuOpen(false)}>
                {link.label}
              </NavLink>
            ))}
          </div>
          <div className="border-t border-indigo-500 px-4 py-3">
            {user && (
              <p className="mb-2 text-sm text-indigo-100">
                Signed in as <span className="font-semibold text-white">{user.name ?? 'User'}</span>
                {role && <span className="ml-1">({role})</span>}
              </p>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-md bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
}