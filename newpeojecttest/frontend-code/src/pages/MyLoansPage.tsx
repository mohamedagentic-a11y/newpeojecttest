import { useCallback, useEffect, useState } from 'react';
import { getMyLoans, returnBook } from '../api/loansApi';
import ErrorAlert from '../components/ErrorAlert';
import type { Loan } from '../types';

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function isOverdue(dueDate: string): boolean {
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

function normalizeLoans(result: unknown): Loan[] {
  if (Array.isArray(result)) return result as Loan[];
  if (result && typeof result === 'object' && Array.isArray((result as { data?: unknown }).data)) {
    return (result as { data: Loan[] }).data;
  }
  return [];
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return fallback;
}

export default function MyLoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [returningId, setReturningId] = useState<string | null>(null);

  const loadLoans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getMyLoans();
      setLoans(normalizeLoans(result));
    } catch (err) {
      setError(errorMessage(err, 'Could not load your loans.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLoans();
  }, [loadLoans]);

  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(null), 4000);
    return () => window.clearTimeout(t);
  }, [success]);

  const handleReturn = async (loan: Loan) => {
    setReturningId(loan.loanId);
    setError(null);
    setSuccess(null);
    try {
      await returnBook(loan.loanId);
      setSuccess(`"${loan.title}" has been returned.`);
      await loadLoans();
    } catch (err) {
      setError(errorMessage(err, 'Could not return the book.'));
    } finally {
      setReturningId(null);
    }
  };

  const overdueCount = loans.filter((l) => isOverdue(l.dueDate)).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Loans</h1>
          <p className="text-sm text-gray-600">
            {loans.length} current loan{loans.length === 1 ? '' : 's'}
            {overdueCount > 0 && (
              <span className="ml-2 font-semibold text-red-600">· {overdueCount} overdue</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadLoans()}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorAlert message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {success && (
        <div
          role="status"
          className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {success}
        </div>
      )}

      {loading && loans.length === 0 ? (
        <div className="py-12 text-center text-gray-500">Loading your loans…</div>
      ) : loans.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-gray-500">
          You have no books on loan.
        </div>
      ) : (
        <>
          {/* Table for medium+ screens */}
          <div className="hidden overflow-hidden rounded-lg border border-gray-200 shadow-sm md:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Author</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Borrowed</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Due</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {loans.map((loan) => {
                  const overdue = isOverdue(loan.dueDate);
                  const busy = returningId === loan.loanId;
                  return (
                    <tr key={loan.loanId} className={overdue ? 'bg-red-50' : undefined}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{loan.title}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{loan.author}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(loan.borrowDate)}</td>
                      <td className={`px-4 py-3 text-sm ${overdue ? 'font-semibold text-red-700' : 'text-gray-700'}`}>
                        {formatDate(loan.dueDate)}
                        {overdue && (
                          <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                            Overdue
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void handleReturn(loan)}
                          disabled={returningId !== null}
                          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy ? 'Returning…' : 'Return'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cards for small screens */}
          <ul className="space-y-3 md:hidden">
            {loans.map((loan) => {
              const overdue = isOverdue(loan.dueDate);
              const busy = returningId === loan.loanId;
              return (
                <li
                  key={loan.loanId}
                  className={`rounded-lg border p-4 shadow-sm ${overdue ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">{loan.title}</h2>
                      <p className="text-sm text-gray-600">{loan.author}</p>
                    </div>
                    {overdue && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        Overdue
                      </span>
                    )}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-gray-500">Borrowed</dt>
                      <dd className="text-gray-800">{formatDate(loan.borrowDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Due</dt>
                      <dd className={overdue ? 'font-semibold text-red-700' : 'text-gray-800'}>
                        {formatDate(loan.dueDate)}
                      </dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={() => void handleReturn(loan)}
                    disabled={returningId !== null}
                    className="mt-4 w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? 'Returning…' : 'Return'}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}