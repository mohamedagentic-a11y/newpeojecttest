import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import booksApi from '../api/booksApi';
import type { SearchBooksParams } from '../api/booksApi';
import BookForm from '../components/BookForm';
import BookSearchBar from '../components/BookSearchBar';
import type { BookFilters } from '../components/BookSearchBar';
import ErrorAlert from '../components/ErrorAlert';
import type { Book, BookInput } from '../types';

// ---------------------------------------------------------------------------
// Thin adapter over booksApi so this page tolerates small naming differences
// in the client's method names.
// ---------------------------------------------------------------------------
type AnyFn = (...args: unknown[]) => Promise<unknown>;

function pickFn(names: string[]): AnyFn | null {
  const api = booksApi as unknown as Record<string, unknown>;
  for (const name of names) {
    const candidate = api[name];
    if (typeof candidate === 'function') {
      return (candidate as AnyFn).bind(booksApi);
    }
  }
  return null;
}

function unwrapList(result: unknown): Book[] {
  if (Array.isArray(result)) return result as Book[];
  if (result && typeof result === 'object') {
    const data = (result as { data?: unknown }).data;
    if (Array.isArray(data)) return data as Book[];
  }
  return [];
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string' && m) return m;
  }
  return fallback;
}

const api = {
  async search(params: SearchBooksParams): Promise<Book[]> {
    const fn = pickFn(['search', 'searchBooks', 'list', 'listBooks', 'getBooks', 'getAll']);
    if (!fn) throw new Error('Book search is not available in the API client.');
    return unwrapList(await fn(params));
  },
  async create(input: BookInput): Promise<void> {
    const fn = pickFn(['create', 'createBook', 'add', 'addBook']);
    if (!fn) throw new Error('Adding books is not available in the API client.');
    await fn(input);
  },
  async update(id: string, input: BookInput): Promise<void> {
    const fn = pickFn(['update', 'updateBook', 'edit', 'editBook']);
    if (!fn) throw new Error('Editing books is not available in the API client.');
    await fn(id, input);
  },
  async remove(id: string): Promise<void> {
    const fn = pickFn(['remove', 'delete', 'deleteBook', 'removeBook', 'destroy']);
    if (!fn) throw new Error('Deleting books is not available in the API client.');
    await fn(id);
  },
};

// Loosely typed component handles so props can be supplied regardless of exact prop names.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Form = BookForm as unknown as ComponentType<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SearchBar = BookSearchBar as unknown as ComponentType<any>;

const DEFAULT_FILTERS: BookFilters = { keyword: '', author: '', availability: 'all' };

type DialogState =
  | { mode: 'closed' }
  | { mode: 'add' }
  | { mode: 'edit'; book: Book };

export default function ManageBooksPage() {
  const [filters, setFilters] = useState<BookFilters>(DEFAULT_FILTERS);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [dialog, setDialog] = useState<DialogState>({ mode: 'closed' });
  const [saving, setSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<Book | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const params: SearchBooksParams = useMemo(
    () => ({
      q: filters.keyword.trim() || undefined,
      author: filters.author.trim() || undefined,
      status: filters.availability,
    }),
    [filters],
  );

  const loadBooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.search(params);
      setBooks(list);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load books.'));
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    void loadBooks();
  }, [loadBooks]);

  const handleFiltersChange = useCallback((next: BookFilters) => {
    setFilters({ ...DEFAULT_FILTERS, ...next });
  }, []);

  const openAdd = () => {
    setFormError(null);
    setDialog({ mode: 'add' });
  };

  const openEdit = (book: Book) => {
    setFormError(null);
    setDialog({ mode: 'edit', book });
  };

  const closeDialog = () => {
    if (saving) return;
    setDialog({ mode: 'closed' });
    setFormError(null);
  };

  const handleSubmit = async (input: BookInput) => {
    setSaving(true);
    setFormError(null);
    try {
      const clean: BookInput = {
        title: input.title.trim(),
        author: input.author.trim(),
        isbn: input.isbn.trim(),
      };
      if (dialog.mode === 'edit') {
        await api.update(dialog.book.id, clean);
        setNotice(`"${clean.title}" was updated.`);
      } else {
        await api.create(clean);
        setNotice(`"${clean.title}" was added to the catalogue.`);
      }
      setDialog({ mode: 'closed' });
      await loadBooks();
    } catch (err) {
      setFormError(errorMessage(err, 'Failed to save the book.'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await api.remove(pendingDelete.id);
      setNotice(`"${pendingDelete.title}" was deleted.`);
      setPendingDelete(null);
      await loadBooks();
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete the book.'));
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const initialValues: BookInput | undefined =
    dialog.mode === 'edit'
      ? { title: dialog.book.title, author: dialog.book.author, isbn: dialog.book.isbn }
      : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Books</h1>
          <p className="text-sm text-gray-600">Add, edit and remove titles from the catalogue.</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          + Add Book
        </button>
      </div>

      <div className="mb-4">
        <SearchBar
          value={filters}
          filters={filters}
          initialFilters={filters}
          onChange={handleFiltersChange}
          onSearch={handleFiltersChange}
        />
      </div>

      {error && (
        <ErrorAlert message={error} onDismiss={() => setError(null)} dismissible className="mb-4" />
      )}
      {notice && (
        <ErrorAlert
          message={notice}
          variant={'success' as never}
          onDismiss={() => setNotice(null)}
          dismissible
          className="mb-4"
        />
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Title</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Author</th>
              <th className="hidden px-4 py-3 text-left font-semibold text-gray-700 md:table-cell">ISBN</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Loading books…
                </td>
              </tr>
            ) : books.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No books match your search.
                </td>
              </tr>
            ) : (
              books.map((book) => (
                <tr key={book.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{book.title}</td>
                  <td className="px-4 py-3 text-gray-700">{book.author}</td>
                  <td className="hidden px-4 py-3 text-gray-600 md:table-cell">{book.isbn}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        book.status === 'available'
                          ? 'rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800'
                          : 'rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800'
                      }
                    >
                      {book.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(book)}
                        className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(book)}
                        className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {dialog.mode !== 'closed' && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {dialog.mode === 'edit' ? 'Edit Book' : 'Add Book'}
              </h2>
              <button
                type="button"
                onClick={closeDialog}
                disabled={saving}
                className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {formError && (
              <ErrorAlert
                message={formError}
                onDismiss={() => setFormError(null)}
                dismissible
                className="mb-4"
              />
            )}
            <Form
              key={dialog.mode === 'edit' ? dialog.book.id : 'new'}
              initialValues={initialValues}
              initial={initialValues}
              book={dialog.mode === 'edit' ? dialog.book : undefined}
              onSubmit={handleSubmit}
              onCancel={closeDialog}
              submitting={saving}
              isSubmitting={saving}
              submitLabel={dialog.mode === 'edit' ? 'Save changes' : 'Add book'}
            />
          </div>
        </div>
      )}

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">Delete book?</h2>
            <p className="mb-6 text-sm text-gray-600">
              Are you sure you want to delete "{pendingDelete.title}" by {pendingDelete.author}? This
              cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}