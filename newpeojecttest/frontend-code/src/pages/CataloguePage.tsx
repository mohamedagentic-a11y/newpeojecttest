import { FormEvent, useCallback, useEffect, useState } from 'react';
import { searchBooks, SearchBooksParams } from '../api/booksApi';
import { borrowBook } from '../api/loansApi';
import { useAuth } from '../auth/AuthContext';
import ErrorAlert from '../components/ErrorAlert';
import type { Book, BookStatus } from '../types';

type StatusFilter = 'all' | BookStatus;

interface AppliedFilters {
  q: string;
  author: string;
  status: StatusFilter;
}

function extractStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as Record<string, unknown>;
  const candidates: unknown[] = [e.status, e.statusCode, e.code];
  const inner = e.error as Record<string, unknown> | undefined;
  if (inner && typeof inner === 'object') candidates.push(inner.code, inner.status);
  for (const c of candidates) {
    const n = typeof c === 'number' ? c : typeof c === 'string' ? Number(c) : NaN;
    if (Number.isFinite(n) && n >= 100 && n < 600) return n;
  }
  return undefined;
}

function extractMessage(err: unknown): string | undefined {
  if (!err) return undefined;
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const e = err as Record<string, unknown>;
    const inner = e.error as Record<string, unknown> | undefined;
    if (inner && typeof inner === 'object' && typeof inner.message === 'string') return inner.message;
    if (typeof e.message === 'string' && e.message) return e.message;
  }
  return undefined;
}

function borrowErrorMessage(err: unknown): string {
  const status = extractStatus(err);
  const msg = extractMessage(err);
  if (status === 409) return msg || 'You have already borrowed this book.';
  if (status === 400) return msg || 'This book is not available to borrow.';
  return msg || 'Could not borrow the book. Please try again.';
}

function StatusBadge({ status }: { status: BookStatus }) {
  const available = status === 'available';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        available ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
      }`}
    >
      {available ? 'Available' : 'Borrowed'}
    </span>
  );
}

export default function CataloguePage() {
  const { user } = useAuth();
  const isMember = user?.role === 'member';

  const [keyword, setKeyword] = useState('');
  const [author, setAuthor] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [applied, setApplied] = useState<AppliedFilters>({ q: '', author: '', status: 'all' });

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [borrowingId, setBorrowingId] = useState<string | null>(null);

  const load = useCallback(async (filters: AppliedFilters) => {
    setLoading(true);
    try {
      const params: SearchBooksParams = {};
      if (filters.q.trim()) params.q = filters.q.trim();
      if (filters.author.trim()) params.author = filters.author.trim();
      if (filters.status !== 'all') params.status = filters.status;
      const result: unknown = await searchBooks(params);
      let list: Book[] = [];
      if (Array.isArray(result)) {
        list = result as Book[];
      } else if (result && typeof result === 'object' && Array.isArray((result as { data?: unknown }).data)) {
        list = (result as { data: Book[] }).data;
      }
      setBooks(list);
    } catch (err) {
      setError(extractMessage(err) || 'Failed to load the catalogue.');
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(applied);
  }, [applied, load]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setApplied({ q: keyword, author, status: statusFilter });
  };

  const handleStatusChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setApplied((prev) => ({ ...prev, q: keyword, author, status: value }));
  };

  const handleClear = () => {
    setKeyword('');
    setAuthor('');
    setStatusFilter('all');
    setError(null);
    setApplied({ q: '', author: '', status: 'all' });
  };

  const handleBorrow = async (book: Book) => {
    setError(null);
    setSuccess(null);
    setBorrowingId(book.id);
    try {
      const result: unknown = await borrowBook(book.id);
      let due = '';
      if (result && typeof result === 'object') {
        const r = result as { dueDate?: string; data?: { dueDate?: string } };
        due = r.dueDate || r.data?.dueDate || '';
      }
      const dueText = due && !Number.isNaN(Date.parse(due)) ? ` Due ${new Date(due).toLocaleDateString()}.` : '';
      setSuccess(`You borrowed "${book.title}".${dueText}`);
      await load(applied);
    } catch (err) {
      setError(borrowErrorMessage(err));
      // Refresh so the status badges reflect the current state (e.g. someone else borrowed it).
      void load(applied);
    } finally {
      setBorrowingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Catalogue</h1>

      <form
        onSubmit={handleSubmit}
        className="mb-6 grid grid-cols-1 gap-4 rounded-lg bg-white p-4 shadow sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="flex flex-col">
          <label htmlFor="keyword" className="mb-1 text-sm font-medium text-gray-700">
            Title or ISBN
          </label>
          <input
            id="keyword"
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="e.g. React or 978-..."
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="author" className="mb-1 text-sm font-medium text-gray-700">
            Author
          </label>
          <input
            id="author"
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Author name"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="status" className="mb-1 text-sm font-medium text-gray-700">
            Availability
          </label>
          <select
            id="status"
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value as StatusFilter)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All</option>
            <option value="available">Available</option>
            <option value="borrowed">Borrowed</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={loading}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Clear
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-4">
          <ErrorAlert message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {success && (
        <div
          role="status"
          className="mb-4 flex items-start justify-between rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800"
        >
          <span>{success}</span>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="ml-4 font-semibold text-green-800 hover:text-green-900"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {loading && books.length === 0 ? (
        <p className="text-sm text-gray-500">Loading catalogue…</p>
      ) : books.length === 0 ? (
        <p className="text-sm text-gray-500">No books match your search.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {books.map((book) => {
            const available = book.status === 'available';
            const busy = borrowingId === book.id;
            return (
              <li key={book.id} className="flex flex-col rounded-lg bg-white p-4 shadow">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h2 className="text-base font-semibold text-gray-900">{book.title}</h2>
                  <StatusBadge status={book.status} />
                </div>
                <p className="text-sm text-gray-700">{book.author}</p>
                <p className="mt-1 text-xs text-gray-500">ISBN: {book.isbn}</p>
                {isMember && available && (
                  <div className="mt-auto pt-4">
                    <button
                      type="button"
                      onClick={() => void handleBorrow(book)}
                      disabled={borrowingId !== null}
                      className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busy ? 'Borrowing…' : 'Borrow'}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}