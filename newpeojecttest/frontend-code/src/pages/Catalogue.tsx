import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/useAuthStore';

interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  status: 'available' | 'borrowed';
}

export const Catalogue: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [borrowingId, setBorrowingId] = useState<string | null>(null);

  const fetchBooks = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/books');
      setBooks(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load catalogue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const handleBorrow = async (bookId: string) => {
    setBorrowingId(bookId);
    setError(null);
    try {
      await apiClient.post('/loans/borrow', { bookId });
      await fetchBooks();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to borrow book.');
    } finally {
      setBorrowingId(null);
    }
  };

  const filteredBooks = books.filter(
    (book) =>
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Library Catalogue</h1>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by title or author..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md border border-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading catalogue...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBooks.length === 0 ? (
            <div className="col-span-full text-center py-10 text-gray-500">
              No books found matching your search.
            </div>
          ) : (
            filteredBooks.map((book) => (
              <div
                key={book.id}
                className="bg-white p-6 rounded-lg shadow-md border border-gray-200 flex flex-col"
              >
                <h2 className="text-xl font-semibold text-gray-900 mb-2">{book.title}</h2>
                <p className="text-gray-600 mb-1">
                  <span className="font-medium">Author:</span> {book.author}
                </p>
                <p className="text-gray-600 mb-4">
                  <span className="font-medium">ISBN:</span> {book.isbn}
                </p>
                <div className="mt-auto flex items-center justify-between">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      book.status === 'available'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {book.status.charAt(0).toUpperCase() + book.status.slice(1)}
                  </span>

                  {user?.role === 'member' && (
                    <button
                      onClick={() => handleBorrow(book.id)}
                      disabled={book.status !== 'available' || borrowingId === book.id}
                      className={`px-4 py-2 rounded-md text-white font-medium transition-colors ${
                        book.status === 'available' && borrowingId !== book.id
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {borrowingId === book.id
                        ? 'Borrowing...'
                        : book.status === 'available'
                        ? 'Borrow'
                        : 'Unavailable'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};