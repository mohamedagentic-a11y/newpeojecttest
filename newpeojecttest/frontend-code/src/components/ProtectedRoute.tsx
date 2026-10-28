import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

type Role = 'member' | 'librarian';

interface ProtectedRouteProps {
  /** When provided, only users whose role is in this list may enter. Others are sent to "/". */
  roles?: Role[];
}

/**
 * Loose view of the auth context. Only fields that may be present are read,
 * and each one is optional, so this guard works with the context's actual shape.
 */
interface AuthView {
  user?: { role?: string } | null;
  token?: string | null;
  isAuthenticated?: boolean;
  loading?: boolean;
  isLoading?: boolean;
  initializing?: boolean;
}

export default function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const auth = useAuth() as unknown as AuthView;
  const location = useLocation();

  const loading = Boolean(auth?.loading ?? auth?.isLoading ?? auth?.initializing ?? false);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          <span className="text-sm">Checking your session…</span>
        </div>
      </div>
    );
  }

  const isAuthenticated =
    typeof auth?.isAuthenticated === 'boolean'
      ? auth.isAuthenticated
      : Boolean(auth?.user || auth?.token);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && roles.length > 0) {
    const role = auth?.user?.role;
    if (!role || !roles.includes(role as Role)) {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
}