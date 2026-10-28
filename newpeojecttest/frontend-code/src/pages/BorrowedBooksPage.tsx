import { useCallback, useEffect, useState } from 'react';
import loansApi from '../api/loansApi';
import ErrorAlert from '../components/ErrorAlert';
import type { ActiveLoan } from '../types';

/**
 * The shared ActiveLoan type covers the book side of a loan. The librarian
 * listing also carries borrower and date details, which may come back under
 * a few different field names, so they are read defensively here.
 */
type BorrowedRow = ActiveLoan & {
  borrower?: string | { name?: string; email?: string } | null;
  borrowerName?: string | null;
  borrowerEmail?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  borrowDate?: string | null;
  borrowedAt?: string | null;
  dueDate?: string | null;
};

function borrowerOf(row: BorrowedRow): string {
  if (row.borrowerName) return row.borrowerName;
  if (typeof row.borrower === 'string' && row.borrower) return row.borrower;
  if (row.borrower && typeof row.borrower === 'object') {
    if (row.borrower.name) return row.borrower.name;
    if (row.borrower.email) return row.borrower.email;
  }
  if (row.userName) return row.userName;
  if (row.borrowerEmail) return row.borrowerEmail;
  if (row.userEmail) return row.userEmail;
  return '—';
}

function borrowDateOf(row: BorrowedRow): string | null | undefined {
  return row.borrowDate ?? row.borrowedAt;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function isOverdue(value?: string | null): boolean {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

function toRows(result: unknown): BorrowedRow[] {
  if (Array.isArray(result)) return result as BorrowedRow[];
  if (result && typeof result === 'object' && Array.isArray((result as { data?: unknown }).data)) {
    return (result as { data: BorrowedRow[] }).data;
  }
  return [];
}

function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === 'string' && msg) return msg;
  }
  return 'Could not load borrowed books.';
}

export default function BorrowedBooksPage() {
  const [rows, setRows] = useState<BorrowedRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('');

  const load = useCallback(async (isActive: () => boolean = () => true) => {
    setLoading(true);
    setError(null);
    try {
      const result: unknown = await (loansApi as unknown as { activeLoans: () => Promise<unknown> }).activeLoans();
      if (!isActive()) return;
      setRows(toRows(result));
    } catch (err) {
      if (!isActive()) return;
      setError(errorMessage(err));
    } finally {
      if (isActive()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void load(() => active);
    return () => {
      active = false;
    };
  }, [load]);

  const term = filter.trim().toLowerCase();
  const visible = term
    ? rows.filter((r) =>
        [r.title, r.author, borrowerOf(r), r.isbn ?? '']
          .join(' ')
          .toLowerCase()
          .includes(term),
      )
    : rows;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Borrowed books</h1>
          <p className="text-sm text-gray-600">All books currently on loan.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by title, author or borrower"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:w-72"
          />
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <ErrorAlert
          message={error}
          title="Unable to load loans"
          dismissible
          onDismiss={() => setError(null)}
          className="mb-4"
        />
      )}

      {loading && rows.length === 0 ? (
        <p className="py-10 text-center text-gray-500">Loading borrowed books…</p>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-gray-500">
          {rows.length === 0 ? 'No books are currently borrowed.' : 'No loans match your filter.'}
        </p>
      ) : (
        <>
          {/* Table for larger screens */}
          <div className="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm md:block">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Borrower</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Borrowed</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((r) => {
                  const overdue = isOverdue(r.dueDate);
                  return (
                    <tr key={r.loanId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{r.title}</div>
                        <div className="text-xs text-gray-500">{r.author}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-800">{borrowerOf(r)}</td>
                      <td className="px-4 py-3 text-gray-800">{formatDate(borrowDateOf(r))}</td>
                      <td className={`px-4 py-3 ${overdue ? 'font-semibold text-red-600' : 'text-gray-800'}`}>
                        {formatDate(r.dueDate)}
                        {overdue && (
                          <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">Overdue</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cards for small screens */}
          <ul className="space-y-3 md:hidden">
            {visible.map((r) => {
              const overdue = isOverdue(r.dueDate);
              return (
                <li key={r.loanId} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="font-medium text-gray-900">{r.title}</div>
                  <div className="mb-2 text-xs text-gray-500">{r.author}</div>
                  <dl className="grid grid-cols-2 gap-1 text-sm">
                    <dt className="text-gray-500">Borrower</dt>
                    <dd className="text-gray-800">{borrowerOf(r)}</dd>
                    <dt className="text-gray-500">Borrowed</dt>
                    <dd className="text-gray-800">{formatDate(borrowDateOf(r))}</dd>
                    <dt className="text-gray-500">Due</dt>
                    <dd className={overdue ? 'font-semibold text-red-600' : 'text-gray-800'}>
                      {formatDate(r.dueDate)}
                      {overdue ? ' (overdue)' : ''}
                    </dd>
                  </dl>
                </li>
              );
            })}
          </ul>

          <p className="mt-4 text-xs text-gray-500">
            Showing {visible.length} of {rows.length} active loan{rows.length === 1 ? '' : 's'}.
          </p>
        </>
      )}
    </div>
  );
}