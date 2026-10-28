import { apiRequest } from './client';
import type { Loan, BorrowedLoan } from './../types/index';

/** Response of POST /loans/borrow */
export interface BorrowResult {
  loanId: string;
  dueDate: string;
}

/** Response of POST /loans/return */
export interface ReturnResult {
  success: boolean;
}

/**
 * The client may or may not already unwrap the `{ data, meta? }` envelope.
 * Accept either shape so callers always receive the payload itself.
 */
function unwrap<T>(res: unknown): T {
  if (
    res !== null &&
    typeof res === 'object' &&
    !Array.isArray(res) &&
    'data' in (res as Record<string, unknown>)
  ) {
    return (res as { data: T }).data;
  }
  return res as T;
}

/** Borrow a specific book (member only). */
export async function borrowBook(bookId: string): Promise<BorrowResult> {
  const res: unknown = await apiRequest('/loans/borrow', {
    method: 'POST',
    body: { bookId },
  });
  return unwrap<BorrowResult>(res);
}

/** Return a borrowed book (member only). */
export async function returnBook(loanId: string): Promise<ReturnResult> {
  const res: unknown = await apiRequest('/loans/return', {
    method: 'POST',
    body: { loanId },
  });
  const payload = unwrap<ReturnResult | undefined>(res);
  return payload ?? { success: true };
}

/** Loans currently held by the signed-in member. */
export async function getMyLoans(signal?: AbortSignal): Promise<Loan[]> {
  const res: unknown = await apiRequest('/loans/my-loans', {
    method: 'GET',
    signal,
  });
  const payload = unwrap<Loan[] | undefined>(res);
  return Array.isArray(payload) ? payload : [];
}

/** All books currently borrowed, with the borrowing member (librarian only). */
export async function getAllBorrowed(
  signal?: AbortSignal,
): Promise<Array<Loan & BorrowedLoan>> {
  const res: unknown = await apiRequest('/loans/borrowed', {
    method: 'GET',
    signal,
  });
  const payload = unwrap<Array<Loan & BorrowedLoan> | undefined>(res);
  return Array.isArray(payload) ? payload : [];
}