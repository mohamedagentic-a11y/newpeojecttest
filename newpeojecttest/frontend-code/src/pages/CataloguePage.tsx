import { useCallback, useEffect, useRef, useState } from 'react';
import { booksApi } from '../api/booksApi';
import type { SearchBooksParams } from '../api/booksApi';
import { loansApi } from '../api/loansApi';
import BookSearchBar from '../components/BookSearchBar';
import type { BookFilters } from '../components/BookSearchBar';
import ErrorAlert from '../components/ErrorAlert';
import { useAuth } from '../auth/AuthContext';
import type { Book } from '../types';

const EMPTY_FILTERS: BookFilters = { keyword: '', author: '', availability: 'all' };

function extractErrorMessage(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object') {
    const e = err as { message?: unknown; error?: { message?: unknown } };
    if (typeof e.message === 'string' && e.message) return e.message;
    if (e.error && typeof e.error.message === 'string' && e.error.message) return e.error.message;
  }
  return fallback;
}

function formatDate(value?: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function toParams(filters: BookFilters): SearchBooksParams {
  const params: SearchBooksParams = {};
  const q = filters.keyword.trim();
  const author = filters.author.trim();
  if (q) params.q = q;
  if (author) params.author = author;
  if (filters.availability && filters.availability !== 'all') {
    params.status = filters.availability;
  }
  return params;
}

function StatusBadge({ status }: { status: Book['status'] }) {
  const s = String(status);
  const isAvailable = s === 'available';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
        isAvailable ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
      }`}
    >
      {s}
    </span>
  );
}

export default function CataloguePage() {
  const auth = useAuth() as unknown as { user?: { role?: string } | null };
  const isMember = auth?.user?.role === 'member';

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [borrowError, setBorrowError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [borrowingId, setBorrowingId] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const lastFiltersRef = useRef<BookFilters>(EMPTY_FILTERS);
  const requestIdRef = useRef(0);

  const runSearch = useCallback(async (filters: BookFilters) => {
    lastFiltersRef.current = filters;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setSearchError(null);
    try {
      const res: unknown = await booksApi.searchBooks(toParams(filters));
      if (requestId !== requestIdRef.current) return;
      const list: Book[] = Array.isArray(res)
        ? (res as Book[])
        : Array.isArray((res as { data?: unknown })?.data)
        ? ((res as { data: Book[] }).data)
        : [];
      setBooks(list);
      setHasSearched(true);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setSearchError(extractErrorMessage(err, 'Unable to search the catalogue. Please try again.'));
      setBooks([]);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runSearch(EMPTY_FILTERS);
  }, [runSearch]);

  const handleSearch = (filters: BookFilters) => {
    setSuccessMessage(null);
    setBorrowError(null);
    void runSearch(filters);
  };

  const handleBorrow = async (book: Book) => {
    if (!isMember || borrowingId) return;
    setBorrowingId(book.id);
    setBorrowError(null);
    setSuccessMessage(null);
    try {
      const result = await loansApi.borrow(book.id);
      const due = formatDate((result as { dueDate?: string } | undefined)?.dueDate);
      setSuccessMessage(
        due
          ? `You borrowed "${book.title}". It is due back on ${due}.`
          : `You borrowed "${book.title}".`
      );
    } catch (err) {
      setBorrowError(extractErrorMessage(err, `Could not borrow "${book.title}". Please try again.`));
    } finally {
      setBorrowingId(null);
      void runSearch(lastFiltersRef.current);
    }
  };

  const renderBorrowAction = (book: Book) => {
    if (!isMember) return null;
    const available = String(book.status) === 'available';
    const busy = borrowingId === book.id;
    return (
      <div className="flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={() => void handleBorrow(book)}
          disabled={!available || borrowingId !== null}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600"
        >
          {busy ? 'Borrowing…' : 'Borrow'}
        </button>
        {!available && <span className="text-xs text-gray-500">Currently on loan</span>}
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Catalogue</h1>
        <p className="mt-1 text-sm text-gray-600">
          Search the library by title keyword, author or availability.
        </p>
      </header>

      <div className="mb-6">
        <BookSearchBar onSearch={handleSearch} />
      </div>

      {successMessage && (
        <div
          role="status"
          className="mb-4 flex items-start justify-between gap-4 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800"
        >
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="font-medium text-green-700 hover:text-green-900"
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {borrowError && (
        <ErrorAlert
          className="mb-4"
          title="Borrowing failed"
          message={borrowError}
          dismissible
          onDismiss={() => setBorrowError(null)}
        />
      )}

      {searchError && (
        <ErrorAlert
          className="mb-4"
          title="Search failed"
          message={searchError}
          dismissible
          onDismiss={() => setSearchError(null)}
        />
      )}

      {loading && (
        <p className="mb-4 text-sm text-gray-500" aria-live="polite">
          Loading results…
        </p>
      )}

      {!loading && hasSearched && books.length === 0 && !searchError && (
        <div className="rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-gray-600">
          No books match your search.
        </div>
      )}

      {books.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-lg border border-gray-200 shadow-sm md:block">
            <table className="min-w-full divide-y divide-gray-200 bg-white">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Author</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">ISBN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Status</th>
                  {isMember && (
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {books.map((book) => (
                  <tr key={book.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{book.title}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{book.author}</td>
                    <td className="px-4 py-3 font-mono text-sm text-gray-600">{book.isbn}</td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={book.status} />
                    </td>
                    {isMember && <td className="px-4 py-3 text-sm">{renderBorrowAction(book)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {books.map((book) => (
              <li key={book.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-gray-900">{book.title}</h2>
                    <p className="text-sm text-gray-700">{book.author}</p>
                    <p className="mt-1 font-mono text-xs text-gray-500">ISBN {book.isbn}</p>
                  </div>
                  <StatusBadge status={book.status} />
                </div>
                {isMember && <div className="mt-3">{renderBorrowAction(book)}</div>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}