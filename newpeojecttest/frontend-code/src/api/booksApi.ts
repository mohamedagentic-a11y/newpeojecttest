import { apiRequest } from './client';
import type { Book, BookInput, BookStatus } from '../types';

export interface SearchBooksParams {
  q?: string;
  author?: string;
  status?: BookStatus | '' | 'all';
}

/**
 * The backend wraps successful payloads as { data, meta }. Depending on how the
 * shared client is implemented, the envelope may already have been removed.
 * Accept both shapes so this module works either way.
 */
function unwrap<T>(result: unknown): T {
  if (
    result !== null &&
    typeof result === 'object' &&
    !Array.isArray(result) &&
    'data' in (result as Record<string, unknown>)
  ) {
    return (result as { data: T }).data;
  }
  return result as T;
}

function buildQuery(params: SearchBooksParams): string {
  const search = new URLSearchParams();
  const q = params.q?.trim();
  const author = params.author?.trim();
  if (q) search.set('q', q);
  if (author) search.set('author', author);
  if (params.status && params.status !== 'all') search.set('status', params.status);
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

async function searchBooks(
  params: SearchBooksParams = {},
  signal?: AbortSignal
): Promise<Book[]> {
  const result = await apiRequest<unknown>(`/books${buildQuery(params)}`, {
    method: 'GET',
    signal,
  });
  const data = unwrap<Book[] | null | undefined>(result);
  return Array.isArray(data) ? data : [];
}

async function createBook(input: BookInput, signal?: AbortSignal): Promise<Book> {
  const result = await apiRequest<unknown>('/books', {
    method: 'POST',
    body: input,
    signal,
  });
  const data = unwrap<Partial<Book> | null | undefined>(result) ?? {};
  // The API may only return { id, status }; merge with the submitted fields.
  return {
    title: input.title,
    author: input.author,
    isbn: input.isbn,
    status: 'available' as BookStatus,
    ...data,
    id: String(data.id ?? ''),
  } as Book;
}

async function updateBook(
  id: string,
  input: Partial<BookInput>,
  signal?: AbortSignal
): Promise<Book> {
  const result = await apiRequest<unknown>(`/books/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: input,
    signal,
  });
  const data = unwrap<Partial<Book> | null | undefined>(result) ?? {};
  return {
    ...(input as Partial<Book>),
    ...data,
    id: String(data.id ?? id),
  } as Book;
}

async function deleteBook(id: string, signal?: AbortSignal): Promise<void> {
  await apiRequest<unknown>(`/books/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    signal,
  });
}

export const booksApi = {
  searchBooks,
  createBook,
  updateBook,
  deleteBook,
};

export default booksApi;