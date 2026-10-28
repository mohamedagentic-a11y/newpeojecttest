import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import CataloguePage from './pages/CataloguePage';
import MyLoansPage from './pages/MyLoansPage';
import ManageBooksPage from './pages/ManageBooksPage';
import BorrowedBooksPage from './pages/BorrowedBooksPage';
import NotFoundPage from './pages/NotFoundPage';
import { useAuth } from './auth/AuthContext';

type Role = 'member' | 'librarian';

/**
 * Reads the signed-in user's role from the auth context defensively,
 * so this file does not depend on the exact shape of the context value.
 */
function useRole(): Role | null {
  const auth = useAuth() as unknown as { user?: { role?: string } | null } | null;
  const role = auth?.user?.role;
  return role === 'member' || role === 'librarian' ? role : null;
}

/**
 * Application shell: navigation chrome (Layout) beside the routed page (Outlet).
 * This is the single <Outlet /> in the route chain.
 */
function AppShell() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      <Layout />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-auto">
        <Outlet />
      </main>
    </div>
  );
}

/** Sends the user to the landing page appropriate for their role. */
function RoleRedirect() {
  const role = useRole();
  if (role === 'librarian') {
    return <Navigate to="/admin/books" replace />;
  }
  return <Navigate to="/catalogue" replace />;
}

/** Renders children only for the given role; otherwise redirects to the catalogue. */
function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const current = useRole();
  if (current !== role) {
    return <Navigate to="/catalogue" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<RoleRedirect />} />
        <Route path="/catalogue" element={<CataloguePage />} />
        <Route
          path="/my-loans"
          element={
            <RequireRole role="member">
              <MyLoansPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/books"
          element={
            <RequireRole role="librarian">
              <ManageBooksPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/loans"
          element={
            <RequireRole role="librarian">
              <BorrowedBooksPage />
            </RequireRole>
          }
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}