// Shared frontend types for the library portal.
// These mirror the shapes returned by the backend REST API under /api/v1.

/** User roles supported by the system. */
export type Role = 'member' | 'librarian';

/** Authenticated user as returned by POST /api/v1/auth/login. */
export interface User {
  id: string;
  name: string;
  role: Role;
  email?: string;
}

/** Availability status of a book in the catalogue. */
export type BookStatus = 'available' | 'borrowed';

/** A book in the catalogue (GET /api/v1/books). */
export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  status: BookStatus;
}

/** Payload for creating or updating a book (librarian only). */
export interface BookInput {
  title: string;
  author: string;
  isbn: string;
}

/** Result of POST /api/v1/loans/borrow. */
export interface Loan {
  loanId: string;
  dueDate: string; // ISO 8601 timestamp
}

/** An active (not yet returned) loan for the current member (GET /api/v1/loans/my-loans). */
export interface ActiveLoan {
  loanId: string;
  bookId: string;
  title: string;
  author: string;
  isbn?: string;
  borrowDate: string; // ISO 8601 timestamp
  dueDate: string; // ISO 8601 timestamp
  returnDate?: string | null;
}

/** The `data` payload of POST /api/v1/auth/login. */
export interface LoginResponse {
  token: string;
  user: User;
}

/** Error shape thrown by the api client, derived from `{ error: { code, message } }`. */
export interface ApiError {
  code: number;
  message: string;
}