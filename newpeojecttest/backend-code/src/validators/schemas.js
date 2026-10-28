const { z } = require('zod');

/**
 * Normalise an ISBN string: strip hyphens and spaces, uppercase a trailing 'x'.
 * @param {string} value
 * @returns {string}
 */
function normalizeIsbn(value) {
  return String(value).replace(/[\s-]/g, '').toUpperCase();
}

/**
 * Validate an ISBN-10 (with checksum; last char may be 'X').
 * @param {string} isbn normalised ISBN
 * @returns {boolean}
 */
function isValidIsbn10(isbn) {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    const ch = isbn[i];
    const digit = ch === 'X' ? 10 : Number(ch);
    sum += digit * (10 - i);
  }
  return sum % 11 === 0;
}

/**
 * Validate an ISBN-13 (with checksum).
 * @param {string} isbn normalised ISBN
 * @returns {boolean}
 */
function isValidIsbn13(isbn) {
  if (!/^\d{13}$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(isbn[12]);
}

/**
 * True when the value is a valid 10- or 13-digit ISBN.
 * @param {string} value
 * @returns {boolean}
 */
function isValidIsbn(value) {
  const isbn = normalizeIsbn(value);
  if (isbn.length === 10) return isValidIsbn10(isbn);
  if (isbn.length === 13) return isValidIsbn13(isbn);
  return false;
}

const isbnField = z
  .string({ required_error: 'ISBN is required.', invalid_type_error: 'ISBN must be a string.' })
  .trim()
  .min(1, 'ISBN is required.')
  .refine(isValidIsbn, { message: 'Invalid ISBN format.' })
  .transform(normalizeIsbn);

const titleField = z
  .string({ required_error: 'Title is required.', invalid_type_error: 'Title must be a string.' })
  .trim()
  .min(1, 'Title is required.')
  .max(255, 'Title must be at most 255 characters.');

const authorField = z
  .string({ required_error: 'Author is required.', invalid_type_error: 'Author must be a string.' })
  .trim()
  .min(1, 'Author is required.')
  .max(255, 'Author must be at most 255 characters.');

const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required.', invalid_type_error: 'Email must be a string.' })
    .trim()
    .toLowerCase()
    .email('A valid email address is required.'),
  password: z
    .string({ required_error: 'Password is required.', invalid_type_error: 'Password must be a string.' })
    .min(1, 'Password is required.')
    .max(200, 'Password is too long.'),
});

const bookCreateSchema = z.object({
  title: titleField,
  author: authorField,
  isbn: isbnField,
});

const bookUpdateSchema = z
  .object({
    title: titleField.optional(),
    author: authorField.optional(),
    isbn: isbnField.optional(),
    status: z.enum(['available', 'borrowed']).optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: 'At least one field must be provided for update.' }
  );

const optionalQueryString = z
  .string()
  .trim()
  .max(255, 'Search term is too long.')
  .optional()
  .transform((v) => (v === undefined || v === '' ? undefined : v));

const bookQuerySchema = z.object({
  q: optionalQueryString,
  author: optionalQueryString,
  status: z
    .union([z.enum(['available', 'borrowed']), z.literal('')])
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
});

const borrowSchema = z.object({
  bookId: z
    .string({ required_error: 'bookId is required.', invalid_type_error: 'bookId must be a string.' })
    .uuid('bookId must be a valid UUID.'),
});

const returnSchema = z.object({
  loanId: z
    .string({ required_error: 'loanId is required.', invalid_type_error: 'loanId must be a string.' })
    .uuid('loanId must be a valid UUID.'),
});

module.exports = {
  loginSchema,
  bookCreateSchema,
  bookUpdateSchema,
  bookQuerySchema,
  borrowSchema,
  returnSchema,
};