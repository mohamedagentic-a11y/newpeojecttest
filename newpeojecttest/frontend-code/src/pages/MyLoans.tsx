import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/useAuthStore';

interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
}

interface Loan {
  id: string;
  book: Book;
  borrowDate: string;
  dueDate: string;
}

export const MyLoans: React.FC = () => {
  const { user } = useAuthStore();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [returningId, setReturningId] = useState<string | null>(null);

  const fetchLoans = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/loans/my-loans');
      setLoans(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load your loans.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLoans();
    }
  }, [user]);

  const handleReturn = async (loanId: string) => {
    setReturningId(loanId);
    setError(null);
    try {
      await apiClient.post('/loans/return', { loanId });
      setLoans((prev) => prev.filter((loan) => loan.id !== loanId));
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to return the book.');
    } finally {
      setReturningId(null);
    }
  };

  if (!user) {
    return (
      <div className="p-8 text-center text-gray-600">
        Please log in to view your loans.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">My Loans</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 border border-red-200 rounded-md">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading your loans...</div>
      ) : loans.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200 text-gray-600">
          You currently have no active loans.
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-200">
          <ul className="divide-y divide-gray-200">
            {loans.map((loan) => (
              <li key={loan.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-lg font-medium text-gray-900">
                    {loan.book?.title || 'Unknown Book'}
                  </span>
                  <span className="text-sm text-gray-500">
                    Due: {new Date(loan.dueDate).toLocaleDateString()}
                  </span>
                </div>
                <button
                  onClick={() => handleReturn(loan.id)}
                  disabled={returningId === loan.id}
                  className={`px-4 py-2 rounded-md text-sm font-medium text-white transition-colors ${
                    returningId === loan.id
                      ? 'bg-indigo-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {returningId === loan.id ? 'Returning...' : 'Return Book'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};