import { useCallback, useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { searchBooks, createBook, updateBook, deleteBook } from '../api/booksApi';
import type { SearchBooksParams } from '../api/booksApi';
import BookForm from '../components/BookForm';
import ErrorAlert from '../components/ErrorAlert';
import type { Book, BookInput } from '../types';

type StatusFilter = '' | 'available' | 'borrowed';

// BookForm's exact prop names are not part of the contract we were given, so we
// pass the commonly used aliases for the prefilled book alongside the handlers.
const Form = BookForm as unknown as ComponentType<Record<string, unknown>>;

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; error?: { message?: unknown } };
    if (typeof e.message === 'string' && e.message) return e.message;
    if (e.error && typeof e.error.message === 'string') return e.error.message;
  }
  return fallback;
}

export default function AdminBooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<Book | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadBooks = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const params: SearchBooksParams = {};
      if (appliedQuery.trim()) params.q = appliedQuery.trim();
      if (statusFilter) params.status = statusFilter as SearchBooksParams['status'];
      const result = await searchBooks(params);
      setBooks(Array.isArray(result) ? (result as Book[]) : []);
    } catch (err) {
      setListError(errorMessage(err, 'Could not load the catalogue.'));
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, [appliedQuery, statusFilter]);

  useEffect(() => {
    void loadBooks();
  }, [loadBooks]);

  const openAdd = () => {
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (book: Book) => {
    setEditing(book);
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
    setFormError(null);
  };

  const handleSubmit = async (input: BookInput) => {
    setSaving(true);
    setFormError(null);
    const payload: BookInput = { title: input.title, author: input.author, isbn: input.isbn };
    try {
      if (editing) {
        await updateBook(editing.id, payload);
        setNotice(`"${payload.title}" was updated.`);
      } else {
        await createBook(payload);
        setNotice(`"${payload.title}" was added to the catalogue.`);
      }
      setFormOpen(false);
      setEditing(null);
      await loadBooks();
    } catch (err) {
      setFormError(errorMessage(err, 'Could not save the book.'));
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (book: Book) => {
    setDeleteError(null);
    setToDelete(book);
  };

  const cancelDelete = () => {
    if (deleting) return;
    setToDelete(null);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteBook(toDelete.id);
      setNotice(`"${toDelete.title}" was deleted.`);
      setToDelete(null);
      await loadBooks();
    } catch (err) {
      setDeleteError(
        errorMessage(
          err,
          toDelete.status === 'borrowed'
            ? 'This book is currently borrowed and cannot be deleted.'
            : 'Could not delete the book.',
        ),
      );
    } finally {
      setDeleting(false);
    }
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedQuery(query);
  };

  const initialValues = editing
    ? { title: editing.title, author: editing.author, isbn: editing.isbn }
    : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Catalogue management</h1>
        <button
          type="button"
          onClick={openAdd}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Add book
        </button>
      </div>

      {notice && (
        <ErrorAlert
          message={notice}
          variant={'success' as never}
          onDismiss={() => setNotice(null)}
          autoDismissMs={4000}
          className="mb-4"
        />
      )}
      {listError && (
        <ErrorAlert message={listError} onDismiss={() => setListError(null)} className="mb-4" />
      )}

      <form onSubmit={onSearch} className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="admin-q" className="block text-sm font-medium text-gray-700">
            Search
          </label>
          <input
            id="admin-q"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title, author or ISBN"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label htmlFor="admin-status" className="block text-sm font-medium text-gray-700">
            Availability
          </label>
          <select
            id="admin-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:w-44 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All</option>
            <option value="available">Available</option>
            <option value="borrowed">Borrowed</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Search
        </button>
      </form>

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
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : books.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  No books found.
                </td>
              </tr>
            ) : (
              books.map((book) => (
                <tr key={book.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{book.title}</td>
                  <td className="px-4 py-3 text-gray-700">{book.author}</td>
                  <td className="hidden px-4 py-3 text-gray-500 md:table-cell">{book.isbn}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        book.status === 'available'
                          ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800'
                          : 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800'
                      }
                    >
                      {book.status === 'available' ? 'Available' : 'Borrowed'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(book)}
                        className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => askDelete(book)}
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

      {formOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {editing ? 'Edit book' : 'Add book'}
            </h2>
            {formError && (
              <ErrorAlert message={formError} onDismiss={() => setFormError(null)} className="mb-4" />
            )}
            <Form
              key={editing ? editing.id : 'new'}
              book={editing ?? undefined}
              initial={initialValues}
              initialValues={initialValues}
              onSubmit={handleSubmit}
              onCancel={closeForm}
              submitting={saving}
              submitLabel={editing ? 'Save changes' : 'Add book'}
            />
          </div>
        </div>
      )}

      {toDelete && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">Delete book</h2>
            <p className="mb-4 text-sm text-gray-700">
              Are you sure you want to delete <strong>"{toDelete.title}"</strong>? This cannot be undone.
            </p>
            {deleteError && <ErrorAlert message={deleteError} className="mb-4" />}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelDelete}
                disabled={deleting}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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