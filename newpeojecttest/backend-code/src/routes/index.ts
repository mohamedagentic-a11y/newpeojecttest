import { Router } from 'express';
import { login } from '../controllers/AuthController';
import { getBooks, addBook, updateBook, deleteBook } from '../controllers/BookController';
import { borrowBook, returnBook, getMyLoans, getAllLoans } from '../controllers/LoanController';
import { authenticate, authorizeRole } from '../middleware/auth';

export const apiRouter = Router();

// Auth
apiRouter.post('/auth/login', login);

// Books
apiRouter.get('/books', authenticate, getBooks);
apiRouter.post('/books', authenticate, authorizeRole('librarian'), addBook);
apiRouter.put('/books/:id', authenticate, authorizeRole('librarian'), updateBook);
apiRouter.delete('/books/:id', authenticate, authorizeRole('librarian'), deleteBook);

// Loans
apiRouter.post('/loans/borrow', authenticate, authorizeRole('member'), borrowBook);
apiRouter.post('/loans/return', authenticate, authorizeRole('member'), returnBook);
apiRouter.get('/loans/my-loans', authenticate, authorizeRole('member'), getMyLoans);
apiRouter.get('/loans', authenticate, authorizeRole('librarian'), getAllLoans);