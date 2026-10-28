export type Role = 'member' | 'librarian';

export interface User {
  id: string;
  name: string;
  role: Role;
  email?: string;
}

export type BookStatus = 'available' | 'borrowed';

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  status: BookStatus;
}

export interface BookInput {
  title: string;
  author: string;
  isbn: string;
}

export interface Loan {
  loanId: string;
  bookId: string;
  title: string;
  author: string;
  borrowDate: string;
  dueDate: string;
}

export interface BorrowedLoan extends Loan {
  memberName: string;
}

export interface ApiError {
  code: number | string;
  message: string;
}