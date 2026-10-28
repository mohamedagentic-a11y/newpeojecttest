import { Link, useLocation } from 'react-router-dom';

export default function NotFoundPage() {
  const location = useLocation();

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md text-center bg-white shadow rounded-lg p-8 sm:p-10">
        <p className="text-6xl sm:text-7xl font-extrabold text-indigo-600">404</p>
        <h1 className="mt-4 text-2xl sm:text-3xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-3 text-gray-600 break-words">
          We couldn&apos;t find{' '}
          <code className="px-1 py-0.5 rounded bg-gray-100 text-gray-800 text-sm">
            {location.pathname}
          </code>
          . It may have been moved or never existed.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Go back home
          </Link>
        </div>
      </div>
    </main>
  );
}