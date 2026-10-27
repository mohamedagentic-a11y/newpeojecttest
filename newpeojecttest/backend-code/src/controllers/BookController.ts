import { Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { Book } from '../entities/Book';

export const getBooks = async (req: Request, res: Response) => {
  try {
    const bookRepository = AppDataSource.getRepository(Book);
    const { keyword, author } = req.query;

    const queryBuilder = bookRepository.createQueryBuilder('book');

    if (keyword) {
      queryBuilder.andWhere('book.title ILIKE :keyword', { keyword: `%${keyword}%` });
    }
    
    if (author) {
      queryBuilder.andWhere('book.author ILIKE :author', { author: `%${author}%` });
    }

    const books = await queryBuilder.getMany();

    return res.status(200).json({
      data: books
    });
  } catch (error) {
    return res.status(500).json({
      error: {
        code: 500,
        message: 'Internal server error while fetching books.'
      }
    });
  }
};

export const addBook = async (req: Request, res: Response) => {
  try {
    const { title, author, isbn } = req.body;

    if (!title || !author || !isbn) {
      return res.status(400).json({
        error: {
          code: 400,
          message: 'Title, author, and isbn are required.'
        }
      });
    }

    const bookRepository = AppDataSource.getRepository(Book);
    
    const existingBook = await bookRepository.findOneBy({ isbn });
    if (existingBook) {
      return res.status(400).json({
        error: {
          code: 400,
          message: 'A book with this ISBN already exists.'
        }
      });
    }

    const newBook = new Book();
    newBook.title = title;
    newBook.author = author;
    newBook.isbn = isbn;
    newBook.status = 'available';

    await bookRepository.save(newBook);

    return res.status(200).json({
      data: {
        id: newBook.id,
        status: newBook.status
      }
    });
  } catch (error) {
    return res.status(500).json({
      error: {
        code: 500,
        message: 'Internal server error while adding book.'
      }
    });
  }
};

export const updateBook = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, author, isbn, status } = req.body;

    const bookRepository = AppDataSource.getRepository(Book);
    const book = await bookRepository.findOneBy({ id });

    if (!book) {
      return res.status(404).json({
        error: {
          code: 404,
          message: 'Book not found.'
        }
      });
    }

    if (title) book.title = title;
    if (author) book.author = author;
    if (isbn) book.isbn = isbn;
    if (status) book.status = status;

    await bookRepository.save(book);

    return res.status(200).json({
      data: book
    });
  } catch (error) {
    return res.status(500).json({
      error: {
        code: 500,
        message: 'Internal server error while updating book.'
      }
    });
  }
};

export const deleteBook = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const bookRepository = AppDataSource.getRepository(Book);
    
    const book = await bookRepository.findOneBy({ id });
    if (!book) {
      return res.status(404).json({
        error: {
          code: 404,
          message: 'Book not found.'
        }
      });
    }

    await bookRepository.remove(book);

    return res.status(200).json({
      data: {
        success: true
      }
    });
  } catch (error) {
    return res.status(500).json({
      error: {
        code: 500,
        message: 'Internal server error while deleting book.'
      }
    });
  }
};