import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { BookStatus } from '../types';

export interface BookFilters {
  keyword: string;
  author: string;
  availability: 'all' | BookStatus;
}

interface BookSearchBarProps {
  onSearch: (filters: BookFilters) => void;
  initialFilters?: Partial<BookFilters>;
  loading?: boolean;
}

const EMPTY_FILTERS: BookFilters = {
  keyword: '',
  author: '',
  availability: 'all',
};

export default function BookSearchBar({ onSearch, initialFilters, loading = false }: BookSearchBarProps) {
  const [keyword, setKeyword] = useState<string>(initialFilters?.keyword ?? EMPTY_FILTERS.keyword);
  const [author, setAuthor] = useState<string>(initialFilters?.author ?? EMPTY_FILTERS.author);
  const [availability, setAvailability] = useState<BookFilters['availability']>(
    initialFilters?.availability ?? EMPTY_FILTERS.availability,
  );

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSearch({
      keyword: keyword.trim(),
      author: author.trim(),
      availability,
    });
  };

  const handleReset = () => {
    setKeyword(EMPTY_FILTERS.keyword);
    setAuthor(EMPTY_FILTERS.author);
    setAvailability(EMPTY_FILTERS.availability);
    onSearch({ ...EMPTY_FILTERS });
  };

  const handleAvailabilityChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setAvailability(e.target.value as BookFilters['availability']);
  };

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="Search the catalogue"
      className="w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-4">
          <label htmlFor="book-search-keyword" className="mb-1 block text-sm font-medium text-gray-700">
            Title or ISBN
          </label>
          <input
            id="book-search-keyword"
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="e.g. React Up and Running or 978-..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div className="lg:col-span-3">
          <label htmlFor="book-search-author" className="mb-1 block text-sm font-medium text-gray-700">
            Author
          </label>
          <input
            id="book-search-author"
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="e.g. Stoyan"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div className="lg:col-span-2">
          <label htmlFor="book-search-availability" className="mb-1 block text-sm font-medium text-gray-700">
            Availability
          </label>
          <select
            id="book-search-availability"
            value={availability}
            onChange={handleAvailabilityChange}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="all">All</option>
            <option value="available">Available</option>
            <option value="borrowed">Borrowed</option>
          </select>
        </div>

        <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reset
          </button>
        </div>
      </div>
    </form>
  );
}