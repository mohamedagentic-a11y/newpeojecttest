import { apiRequest } from './client';
import type { Loan, ActiveLoan } from './../types/index';

/**
 * Result of a successful borrow: the new loan id plus its due date
 * (the API returns `{ loanId, dueDate }`).
 */
export type BorrowResult = Loan & { dueDate?: string };

/** Result of a successful return (the API returns `{ success: true }`). */
export interface ReturnResult {
  success: boolean;
}

/**
 * The API wraps successful payloads as `{ data: ... }`. The shared client may
 * or may not unwrap that envelope already, so unwrap it here when it is
 * still present. This keeps callers working either way.
 */
function unwrap<T>(payload: unknown): T {
  if (
    payload !== null &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    'data' in (payload as Record<string, unknown>)
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export const loansApi = {
  /** POST /loans/borrow: borrows the given book for the signed-in member. */
  async borrow(bookId: string, signal?: AbortSignal): Promise<BorrowResult> {
    const res = await apiRequest<unknown>('/loans/borrow', {
      method: 'POST',
      body: { bookId },
      signal,
    });
    return unwrap<BorrowResult>(res);
  },

  /** POST /loans/return: returns a borrowed book by loan id. */
  async returnBook(loanId: string, signal?: AbortSignal): Promise<ReturnResult> {
    const res = await apiRequest<unknown>('/loans/return', {
      method: 'POST',
      body: { loanId },
      signal,
    });
    const data = unwrap<ReturnResult | undefined>(res);
    return { success: data?.success ?? true };
  },

  /** GET /loans/my-loans: the signed-in member's current loans. */
  async myLoans(signal?: AbortSignal): Promise<ActiveLoan[]> {
    const res = await apiRequest<unknown>('/loans/my-loans', {
      method: 'GET',
      signal,
    });
    return toArray<ActiveLoan>(unwrap<unknown>(res));
  },

  /** GET /loans/active: all loans currently outstanding (librarian view). */
  async activeLoans(signal?: AbortSignal): Promise<ActiveLoan[]> {
    const res = await apiRequest<unknown>('/loans/active', {
      method: 'GET',
      signal,
    });
    return toArray<ActiveLoan>(unwrap<unknown>(res));
  },
};

export default loansApi;