import { apiRequest } from './client';
import type { ApiRequestOptions } from './client';
import type { Book, BookInput, BookStatus } from '../types';

export interface SearchBooksParams {
  q?: string;
  author?: string;
  status?: BookStatus | '' | 'all';
}

/**
 * The client may hand back either the full `{data, meta}` envelope or the
 * already-unwrapped payload. Normalize both shapes to the payload.
 */
function unwrap<T>(response: unknown): T {
  if (
    response !== null &&
    typeof response === 'object' &&
    !Array.isArray(response) &&
    'data' in (response as Record<string, unknown>)
  ) {
    return (response as { data: T }).data;
  }
  return response as T;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value.trim() !== '') {
      search.append(key, value.trim());
    }
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export async function searchBooks(
  params: SearchBooksParams = {},
  signal?: AbortSignal,
): Promise<Book[]> {
  const status =
    params.status && params.status !== 'all' ? String(params.status) : undefined;
  const query = buildQuery({ q: params.q, author: params.author, status });
  const options: ApiRequestOptions = { method: 'GET', signal };
  const response = await apiRequest<unknown>(`/books${query}`, options);
  const data = unwrap<Book[] | null | undefined>(response);
  return Array.isArray(data) ? data : [];
}

export async function createBook(input: BookInput): Promise<Book> {
  const options: ApiRequestOptions = { method: 'POST', body: input };
  const response = await apiRequest<unknown>('/books', options);
  const data = unwrap<Partial<Book> | null | undefined>(response) ?? {};
  return {
    title: input.title,
    author: input.author,
    isbn: input.isbn,
    status: 'available' as BookStatus,
    ...data,
    id: String(data.id ?? ''),
  } as Book;
}

export async function updateBook(id: string, input: BookInput): Promise<Book> {
  const options: ApiRequestOptions = { method: 'PUT', body: input };
  const response = await apiRequest<unknown>(
    `/books/${encodeURIComponent(id)}`,
    options,
  );
  const data = unwrap<Partial<Book> | null | undefined>(response) ?? {};
  return {
    id,
    title: input.title,
    author: input.author,
    isbn: input.isbn,
    status: 'available' as BookStatus,
    ...data,
  } as Book;
}

export async function deleteBook(id: string): Promise<void> {
  const options: ApiRequestOptions = { method: 'DELETE' };
  await apiRequest<unknown>(`/books/${encodeURIComponent(id)}`, options);
}