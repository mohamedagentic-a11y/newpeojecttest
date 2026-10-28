import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import ErrorAlert from '../components/ErrorAlert';

type Role = 'member' | 'librarian';

interface SessionUser {
  id?: string;
  name?: string;
  role?: Role | string;
}

interface AuthLike {
  user?: SessionUser | null;
  token?: string | null;
  login: (email: string, password: string) => Promise<unknown>;
}

function destinationFor(role: unknown): string {
  return role === 'librarian' ? '/admin/books' : '/catalogue';
}

function extractRole(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.role === 'string') return v.role;
  if (v.user && typeof v.user === 'object') {
    const u = v.user as Record<string, unknown>;
    if (typeof u.role === 'string') return u.role;
  }
  return undefined;
}

function extractStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as Record<string, unknown>;
  if (typeof e.status === 'number') return e.status;
  if (typeof e.statusCode === 'number') return e.statusCode;
  if (typeof e.code === 'number') return e.code;
  return undefined;
}

export default function LoginPage() {
  const auth = useAuth() as unknown as AuthLike;
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUser = auth.user ?? null;

  // If the session already holds a signed-in user (including right after a
  // successful login updates AuthContext), send them to their home screen.
  useEffect(() => {
    if (currentUser && currentUser.role) {
      navigate(destinationFor(currentUser.role), { replace: true });
    }
  }, [currentUser, navigate]);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      // AuthContext.login performs the API call and writes the user + token
      // into the auth session that the route guards read.
      const result = await auth.login(email.trim(), password);
      const role = extractRole(result);
      if (role) {
        navigate(destinationFor(role), { replace: true });
      }
      // Otherwise the effect above navigates once AuthContext exposes the user.
    } catch (err) {
      const status = extractStatus(err);
      if (status === 401) {
        setError('Invalid email or password.');
      } else if (status === 400) {
        setError('Please enter a valid email address and password.');
      } else if (err instanceof Error && err.message) {
        setError(err.message);
      } else {
        setError('Sign-in failed. Please try again.');
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Library Portal</h1>
          <p className="mt-2 text-sm text-gray-600">Sign in to your account</p>
        </div>

        <div className="bg-white shadow rounded-lg p-6 sm:p-8">
          {error && (
            <ErrorAlert
              message={error}
              title="Sign-in failed"
              dismissible
              onDismiss={() => setError(null)}
              className="mb-4"
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
              />
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full flex justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
            {!submitting && !canSubmit && (
              <p className="text-xs text-gray-500 text-center">
                Enter your email and password to sign in.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}