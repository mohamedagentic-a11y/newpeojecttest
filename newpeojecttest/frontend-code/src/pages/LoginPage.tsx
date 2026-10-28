import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import ErrorAlert from '../components/ErrorAlert';

interface LoginUser {
  id: string;
  name: string;
  role: 'member' | 'librarian';
}

interface LoginResponse {
  data?: { token?: string; user?: LoginUser };
  error?: { code?: number | string; message?: string };
}

/**
 * The context contract documented for this build exposes { token, user }.
 * If the provider also offers a sign-in action at runtime, it is used so the
 * context state is written directly. It is accessed as optional and guarded,
 * never assumed.
 */
type OptionalAuthActions = {
  login?: (email: string, password: string) => Promise<unknown>;
};

// Fallback storage keys, used only when the context offers no sign-in action.
// A full-page navigation follows, so AuthProvider re-initialises from storage.
const FALLBACK_TOKEN_KEY = 'token';
const FALLBACK_USER_KEY = 'user';

async function requestLogin(email: string, password: string): Promise<{ token: string; user: LoginUser }> {
  let res: Response;
  try {
    res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error('Unable to reach the server. Please check your connection and try again.');
  }

  let body: LoginResponse | null = null;
  try {
    body = (await res.json()) as LoginResponse;
  } catch {
    body = null;
  }

  if (!res.ok) {
    const message =
      body?.error?.message ??
      (res.status === 401 ? 'Invalid email or password.' : `Sign-in failed (HTTP ${res.status}).`);
    throw new Error(message);
  }

  const token = body?.data?.token;
  const user = body?.data?.user;
  if (!token || !user) {
    throw new Error('The server returned an unexpected response. Please try again.');
  }
  return { token, user };
}

export default function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);

    const trimmedEmail = email.trim();
    const contextLogin = (auth as unknown as OptionalAuthActions).login;

    try {
      if (typeof contextLogin === 'function') {
        // Writes token and user into AuthContext, then navigate.
        await contextLogin(trimmedEmail, password);
        navigate('/', { replace: true });
        return;
      }

      // Fallback: authenticate directly, persist the session, and perform a full
      // navigation so AuthProvider initialises its token/user state from storage.
      const { token, user } = await requestLogin(trimmedEmail, password);
      window.localStorage.setItem(FALLBACK_TOKEN_KEY, token);
      window.localStorage.setItem(FALLBACK_USER_KEY, JSON.stringify(user));
      window.location.assign('/');
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Sign-in failed. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Library Portal</h1>
          <p className="mt-2 text-sm text-gray-600">Sign in to your account</p>
        </div>

        <div className="bg-white shadow rounded-lg p-6 sm:p-8">
          {error && (
            <ErrorAlert
              className="mb-4"
              title="Sign-in failed"
              message={error}
              onDismiss={() => setError(null)}
            />
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
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
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
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
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full flex justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
            {!submitting && !canSubmit && (
              <p className="text-xs text-gray-500 text-center">Enter your email and password to sign in.</p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}