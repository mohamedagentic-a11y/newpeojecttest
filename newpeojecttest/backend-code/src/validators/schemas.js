const { z } = require('zod');

const trimmedNonEmpty = (field, max) =>
  z
    .string({
      required_error: `${field} is required.`,
      invalid_type_error: `${field} must be a string.`,
    })
    .trim()
    .min(1, `${field} is required.`)
    .max(max, `${field} must be at most ${max} characters.`);

const loginSchema = z.object({
  email: z
    .string({
      required_error: 'Email is required.',
      invalid_type_error: 'Email must be a string.',
    })
    .trim()
    .toLowerCase()
    .email('Invalid email address.'),
  password: z
    .string({
      required_error: 'Password is required.',
      invalid_type_error: 'Password must be a string.',
    })
    .min(1, 'Password is required.'),
});

const isbnSchema = z
  .string({
    required_error: 'ISBN is required.',
    invalid_type_error: 'ISBN must be a string.',
  })
  .trim()
  .regex(/^[0-9-]{10,17}$/, 'Invalid ISBN format.');

const bookCreateSchema = z.object({
  title: trimmedNonEmpty('Title', 255),
  author: trimmedNonEmpty('Author', 255),
  isbn: isbnSchema,
});

const bookUpdateSchema = bookCreateSchema
  .partial()
  .refine((value) => Object.keys(value).some((k) => value[k] !== undefined), {
    message: 'At least one field (title, author, isbn) must be provided.',
  });

const optionalQueryString = z
  .string()
  .trim()
  .max(255)
  .optional()
  .transform((v) => (v === undefined || v === '' ? undefined : v));

const bookQuerySchema = z.object({
  q: optionalQueryString,
  author: optionalQueryString,
  status: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z
      .enum(['available', 'borrowed'], {
        errorMap: () => ({ message: "Status must be 'available' or 'borrowed'." }),
      })
      .optional()
  ),
});

const borrowSchema = z.object({
  bookId: z
    .string({
      required_error: 'bookId is required.',
      invalid_type_error: 'bookId must be a string.',
    })
    .uuid('bookId must be a valid UUID.'),
});

const returnSchema = z.object({
  loanId: z
    .string({
      required_error: 'loanId is required.',
      invalid_type_error: 'loanId must be a string.',
    })
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