import { useCallback, useEffect, useState } from 'react';
import loansApi from '../api/loansApi';
import ErrorAlert from '../components/ErrorAlert';
import type { AlertVariant } from '../components/ErrorAlert';
import type { ActiveLoan } from '../types';

type LoanRow = ActiveLoan & {
  dueDate?: string | null;
  borrowDate?: string | null;
};

function normaliseLoans(result: unknown): LoanRow[] {
  if (Array.isArray(result)) return result as LoanRow[];
  if (result && typeof result === 'object' && Array.isArray((result as { data?: unknown }).data)) {
    return (result as { data: LoanRow[] }).data;
  }
  return [];
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value?: string | null): string {
  const d = parseDate(value);
  return d ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}

function isOverdue(value?: string | null): boolean {
  const d = parseDate(value);
  return d ? d.getTime() < Date.now() : false;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return fallback;
}

export default function MyLoansPage() {
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [returningId, setReturningId] = useState<string | null>(null);

  const loadLoans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loansApi.myLoans();
      setLoans(normaliseLoans(result).filter((l) => !l.returnDate));
    } catch (err) {
      setError(errorMessage(err, 'Could not load your loans.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLoans();
  }, [loadLoans]);

  const handleReturn = async (loan: LoanRow) => {
    setReturningId(loan.loanId);
    setError(null);
    setSuccess(null);
    try {
      await loansApi.returnBook(loan.loanId);
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
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Loans</h1>
          <p className="text-sm text-gray-600">
            Books you currently have on loan.
            {overdueCount > 0 && (
              <span className="ml-2 font-semibold text-red-600">
                {overdueCount} overdue
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadLoans()}
          disabled={loading}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <ErrorAlert
          message={error}
          dismissible
          onDismiss={() => setError(null)}
          className="mb-4"
        />
      )}
      {success && (
        <ErrorAlert
          message={success}
          variant={'success' as AlertVariant}
          dismissible
          onDismiss={() => setSuccess(null)}
          className="mb-4"
        />
      )}

      {loading && loans.length === 0 ? (
        <div className="py-12 text-center text-gray-500">Loading your loans…</div>
      ) : loans.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-gray-500">
          You have no books on loan right now.
        </div>
      ) : (
        <ul className="space-y-3">
          {loans.map((loan) => {
            const overdue = isOverdue(loan.dueDate);
            const busy = returningId === loan.loanId;
            return (
              <li
                key={loan.loanId}
                className={`flex flex-col gap-3 rounded-lg border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
                  overdue ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-gray-900">{loan.title}</h2>
                  <p className="text-sm text-gray-600">by {loan.author}</p>
                  {loan.isbn && <p className="text-xs text-gray-500">ISBN {loan.isbn}</p>}
                  <p className={`mt-1 text-sm ${overdue ? 'font-semibold text-red-700' : 'text-gray-700'}`}>
                    Due: {formatDate(loan.dueDate)}
                    {overdue && (
                      <span className="ml-2 inline-block rounded bg-red-600 px-2 py-0.5 text-xs font-bold uppercase text-white">
                        Overdue
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleReturn(loan)}
                  disabled={returningId !== null}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? 'Returning…' : 'Return'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}