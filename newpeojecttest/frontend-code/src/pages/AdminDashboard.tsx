import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/useAuthStore';

interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  status: string;
}

export const AdminDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [adding, setAdding] = useState<boolean>(false);
  const [addError, setAddError] = useState<string | null>(null);

  const fetchBooks = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/books');
      setBooks(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load books.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'librarian') {
      fetchBooks();
    }
  }, [user]);

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setAddError(null);
    try {
      await apiClient.post('/books', { title, author, isbn });
      setTitle('');
      setAuthor('');
      setIsbn('');
      await fetchBooks();
    } catch (err: any) {
      setAddError(err.response?.data?.error?.message || 'Failed to add book.');
    } finally {
      setAdding(false);
    }
  };

  if (!user || user.role !== 'librarian') {
    return (
      <div className="p-8 text-center text-red-600 font-semibold">
        Access Denied. Librarian privileges required.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Librarian Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Add New Book</h2>
            {addError && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">
                {addError}
              </div>
            )}
            <form onSubmit={handleAddBook} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
                <input
                  type="text"
                  required
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
                <input
                  type="text"
                  required
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={adding || !title || !author || !isbn}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {adding ? 'Adding...' : 'Add Book'}
              </button>
            </form>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-700">Catalogue</h2>
              <button
                onClick={fetchBooks}
                disabled={loading}
                className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading books...</div>
            ) : error ? (
              <div className="text-center py-8 text-red-600">{error}</div>
            ) : books.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No books found in the catalogue.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="py-3 px-4 text-sm font-medium text-gray-600">Title</th>
                      <th className="py-3 px-4 text-sm font-medium text-gray-600">Author</th>
                      <th className="py-3 px-4 text-sm font-medium text-gray-600">ISBN</th>
                      <th className="py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {books.map((book) => (
                      <tr key={book.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-800">{book.title}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{book.author}</td>
                        <td className="py-3 px-4 text-sm text-gray-500">{book.isbn}</td>
                        <td className="py-3 px-4 text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              book.status === 'available'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {book.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};