import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAllBorrowed } from '../api/loansApi';
import ErrorAlert from '../components/ErrorAlert';
import type { BorrowedLoan, Loan } from '../types';

type BorrowedRow = Loan & BorrowedLoan;

function normalizeRows(result: unknown): BorrowedRow[] {
  if (Array.isArray(result)) return result as BorrowedRow[];
  if (result && typeof result === 'object' && Array.isArray((result as { data?: unknown }).data)) {
    return (result as { data: BorrowedRow[] }).data;
  }
  return [];
}

function formatDate(value: string | undefined | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function isOverdue(dueDate: string | undefined | null): boolean {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return 'Failed to load borrowed books.';
}

export default function BorrowedBooksPage() {
  const [rows, setRows] = useState<BorrowedRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAllBorrowed();
      setRows(normalizeRows(result));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const sorted = [...rows].sort((a, b) => {
      const ta = new Date(a.dueDate).getTime() || 0;
      const tb = new Date(b.dueDate).getTime() || 0;
      return ta - tb;
    });
    if (!q) return sorted;
    return sorted.filter(
      (r) =>
        (r.title ?? '').toLowerCase().includes(q) ||
        (r.memberName ?? '').toLowerCase().includes(q) ||
        (r.author ?? '').toLowerCase().includes(q),
    );
  }, [rows, filter]);

  const overdueCount = useMemo(() => rows.filter((r) => isOverdue(r.dueDate)).length, [rows]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Borrowed Books</h1>
          <p className="mt-1 text-sm text-gray-600">
            All books currently on loan.
            {!loading && rows.length > 0 && (
              <>
                {' '}
                {rows.length} on loan
                {overdueCount > 0 && <span className="font-medium text-red-600">, {overdueCount} overdue</span>}.
              </>
            )}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by title, author or member"
            aria-label="Filter borrowed books"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-64"
          />
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorAlert message={error} title="Could not load borrowed books" onDismiss={() => setError(null)} />
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          Loading borrowed books…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          {rows.length === 0 ? 'No books are currently borrowed.' : 'No borrowed books match your filter.'}
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="space-y-3 md:hidden">
            {filtered.map((r) => {
              const overdue = isOverdue(r.dueDate);
              return (
                <li key={r.loanId} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="font-semibold text-gray-900">{r.title}</div>
                  {r.author && <div className="text-sm text-gray-500">{r.author}</div>}
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <dt className="text-gray-500">Member</dt>
                    <dd className="text-gray-900">{r.memberName || '—'}</dd>
                    <dt className="text-gray-500">Borrowed</dt>
                    <dd className="text-gray-900">{formatDate(r.borrowDate)}</dd>
                    <dt className="text-gray-500">Due</dt>
                    <dd className={overdue ? 'font-medium text-red-600' : 'text-gray-900'}>
                      {formatDate(r.dueDate)}
                      {overdue && ' (overdue)'}
                    </dd>
                  </dl>
                </li>
              );
            })}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm md:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Title</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Member</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Borrow Date</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => {
                  const overdue = isOverdue(r.dueDate);
                  return (
                    <tr key={r.loanId} className={overdue ? 'bg-red-50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">{r.title}</div>
                        {r.author && <div className="text-gray-500">{r.author}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{r.memberName || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(r.borrowDate)}</td>
                      <td className={`px-4 py-3 text-sm ${overdue ? 'font-medium text-red-600' : 'text-gray-700'}`}>
                        {formatDate(r.dueDate)}
                        {overdue && (
                          <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                            Overdue
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}