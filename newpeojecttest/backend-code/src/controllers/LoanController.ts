import { Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { Loan } from '../entities/Loan';
import { Book } from '../entities/Book';

export const borrowBook = async (req: Request, res: Response) => {
  const { bookId } = req.body;
  const userId = (req as any).user?.id;

  if (!bookId) {
    return res.status(400).json({ error: { code: 400, message: 'bookId is required' } });
  }

  try {
    const result = await AppDataSource.transaction(async (transactionalEntityManager) => {
      const book = await transactionalEntityManager.findOne(Book, {
        where: { id: bookId },
        lock: { mode: 'pessimistic_write' }
      });

      if (!book) {
        throw new Error('Book not found');
      }

      if (book.status === 'borrowed') {
        throw new Error('Book is already borrowed');
      }

      book.status = 'borrowed';
      await transactionalEntityManager.save(book);

      const loan = new Loan();
      loan.book = book;
      loan.user = userId; // Assuming TypeORM handles the relation by ID or we pass { id: userId }
      loan.borrowDate = new Date();
      
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14); // 14 days loan period
      loan.dueDate = dueDate;

      await transactionalEntityManager.save(loan);

      return loan;
    });

    return res.status(200).json({
      data: {
        loanId: result.id,
        dueDate: result.dueDate
      }
    });
  } catch (error: any) {
    return res.status(400).json({
      error: {
        code: 400,
        message: error.message || 'Failed to borrow book'
      }
    });
  }
};

export const returnBook = async (req: Request, res: Response) => {
  const { loanId } = req.body;

  if (!loanId) {
    return res.status(400).json({ error: { code: 400, message: 'loanId is required' } });
  }

  try {
    await AppDataSource.transaction(async (transactionalEntityManager) => {
      const loan = await transactionalEntityManager.findOne(Loan, {
        where: { id: loanId },
        relations: ['book'],
        lock: { mode: 'pessimistic_write' }
      });

      if (!loan) {
        throw new Error('Loan not found');
      }

      if (loan.returnDate) {
        throw new Error('Book is already returned');
      }

      loan.returnDate = new Date();
      await transactionalEntityManager.save(loan);

      if (loan.book) {
        loan.book.status = 'available';
        await transactionalEntityManager.save(loan.book);
      }
    });

    return res.status(200).json({
      data: {
        success: true
      }
    });
  } catch (error: any) {
    return res.status(400).json({
      error: {
        code: 400,
        message: error.message || 'Failed to return book'
      }
    });
  }
};

export const getMyLoans = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;

  try {
    const loanRepository = AppDataSource.getRepository(Loan);
    const loans = await loanRepository.find({
      where: { user: { id: userId } },
      relations: ['book']
    });

    return res.status(200).json({
      data: loans
    });
  } catch (error: any) {
    return res.status(500).json({
      error: {
        code: 500,
        message: 'Internal server error'
      }
    });
  }
};

export const getAllLoans = async (req: Request, res: Response) => {
  try {
    const loanRepository = AppDataSource.getRepository(Loan);
    const loans = await loanRepository.find({
      relations: ['book', 'user']
    });

    return res.status(200).json({
      data: loans
    });
  } catch (error: any) {
    return res.status(500).json({
      error: {
        code: 500,
        message: 'Internal server error'
      }
    });
  }
};