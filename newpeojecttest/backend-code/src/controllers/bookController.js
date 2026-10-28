// Book controller: HTTP handlers wrapping bookService.
// Every success response uses the { data } envelope; errors use { error: { code, message } }.
const { z } = require('zod');
const { bookService } = require('../services/bookService');

const listQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  keyword: z.string().trim().max(200).optional(),
  author: z.string().trim().max(200).optional(),
});

const createBookSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(255),
  author: z.string().trim().min(1, 'Author is required.').max(255),
  isbn: z
    .string()
    .trim()
    .min(10, 'Invalid ISBN format.')
    .max(17, 'Invalid ISBN format.')
    .regex(/^[0-9Xx-]+$/, 'Invalid ISBN format.'),
});

const updateBookSchema = createBookSchema
  .extend({
    status: z.enum(['available', 'borrowed']).optional(),
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field must be provided.',
  });

const idParamSchema = z.object({
  id: z.string().trim().min(1, 'Book id is required.'),
});

function sendError(res, code, message) {
  return res.status(code).json({ error: { code, message } });
}

function firstIssue(result) {
  const issue = result.error && result.error.issues && result.error.issues[0];
  return issue ? issue.message : 'Invalid request.';
}

// Resolve a service method by its expected name, tolerating common alternatives.
function resolve(names) {
  for (const name of names) {
    if (bookService && typeof bookService[name] === 'function') {
      return bookService[name].bind(bookService);
    }
  }
  throw new Error(`bookService does not implement any of: ${names.join(', ')}`);
}

const bookController = {
  async list(req, res, next) {
    try {
      const parsed = listQuerySchema.safeParse(req.query || {});
      if (!parsed.success) return sendError(res, 400, firstIssue(parsed));
      const { q, keyword, author } = parsed.data;
      const fn = resolve(['list', 'listBooks', 'search', 'searchBooks']);
      const books = await fn({ q: q || keyword || undefined, author: author || undefined });
      return res.status(200).json({ data: books || [] });
    } catch (err) {
      return next(err);
    }
  },

  async create(req, res, next) {
    try {
      const parsed = createBookSchema.safeParse(req.body || {});
      if (!parsed.success) return sendError(res, 400, firstIssue(parsed));
      const fn = resolve(['create', 'createBook']);
      const book = await fn(parsed.data);
      return res.status(200).json({ data: book });
    } catch (err) {
      if (err && err.code === '23505') {
        return sendError(res, 409, 'A book with this ISBN already exists.');
      }
      return next(err);
    }
  },

  async update(req, res, next) {
    try {
      const params = idParamSchema.safeParse(req.params || {});
      if (!params.success) return sendError(res, 400, firstIssue(params));
      const parsed = updateBookSchema.safeParse(req.body || {});
      if (!parsed.success) return sendError(res, 400, firstIssue(parsed));
      const fn = resolve(['update', 'updateBook']);
      const book = await fn(params.data.id, parsed.data);
      if (!book) return sendError(res, 404, 'Book not found.');
      return res.status(200).json({ data: book });
    } catch (err) {
      if (err && err.code === '23505') {
        return sendError(res, 409, 'A book with this ISBN already exists.');
      }
      if (err && err.code === '22P02') {
        return sendError(res, 400, 'Invalid book id.');
      }
      return next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const params = idParamSchema.safeParse(req.params || {});
      if (!params.success) return sendError(res, 400, firstIssue(params));
      const fn = resolve(['remove', 'removeBook', 'delete', 'deleteBook']);
      const result = await fn(params.data.id);
      if (result === null || result === false || result === undefined) {
        return sendError(res, 404, 'Book not found.');
      }
      return res.status(200).json({ data: { success: true, id: params.data.id } });
    } catch (err) {
      if (err && err.code === '23503') {
        return sendError(res, 409, 'Book cannot be removed while it has loan records.');
      }
      if (err && err.code === '22P02') {
        return sendError(res, 400, 'Invalid book id.');
      }
      return next(err);
    }
  },
};

module.exports = { bookController };