const { z } = require('zod');
const bookService = require('../services/bookService');

/**
 * Resolve a service function by trying the likely export names in order.
 * Resolution happens at call time, so a missing function surfaces as a
 * clear 500 error instead of crashing the module on load.
 */
function resolveServiceFn(candidates) {
  for (const name of candidates) {
    if (bookService && typeof bookService[name] === 'function') {
      return bookService[name].bind(bookService);
    }
  }
  const err = new Error(
    `Book service does not provide any of: ${candidates.join(', ')}`
  );
  err.status = 500;
  err.statusCode = 500;
  throw err;
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.statusCode = status;
  err.code = status;
  err.expose = true;
  return err;
}

function zodMessage(result) {
  const issue = result.error && result.error.issues && result.error.issues[0];
  if (!issue) return 'Invalid request.';
  const path = issue.path && issue.path.length ? `${issue.path.join('.')}: ` : '';
  return `${path}${issue.message}`;
}

const nonEmpty = (label) =>
  z
    .string({ required_error: `${label} is required.`, invalid_type_error: `${label} must be a string.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(500, `${label} is too long.`);

const isbnSchema = z
  .string({ required_error: 'ISBN is required.', invalid_type_error: 'ISBN must be a string.' })
  .trim()
  .min(1, 'ISBN is required.')
  .max(32, 'Invalid ISBN format.')
  .regex(/^[0-9Xx-]+$/, 'Invalid ISBN format.');

const listQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  author: z.string().trim().max(200).optional(),
});

const createSchema = z.object({
  title: nonEmpty('Title'),
  author: nonEmpty('Author'),
  isbn: isbnSchema,
});

const updateSchema = z
  .object({
    title: nonEmpty('Title').optional(),
    author: nonEmpty('Author').optional(),
    isbn: isbnSchema.optional(),
    status: z.enum(['available', 'borrowed']).optional(),
  })
  .refine((v) => Object.keys(v).some((k) => v[k] !== undefined), {
    message: 'At least one field must be provided.',
  });

const idSchema = z.string().trim().min(1, 'Book id is required.').max(100);

function parseId(req) {
  const result = idSchema.safeParse(req.params && req.params.id);
  if (!result.success) throw httpError(400, zodMessage(result));
  return result.data;
}

async function list(req, res, next) {
  try {
    const parsed = listQuerySchema.safeParse(req.query || {});
    if (!parsed.success) throw httpError(400, zodMessage(parsed));
    const filters = {};
    if (parsed.data.q) filters.q = parsed.data.q;
    if (parsed.data.author) filters.author = parsed.data.author;

    const fn = resolveServiceFn(['listBooks', 'list', 'searchBooks', 'search', 'getBooks', 'findAll']);
    const result = await fn(filters);
    const books = Array.isArray(result) ? result : result && Array.isArray(result.data) ? result.data : [];
    res.status(200).json({ data: books, meta: { count: books.length } });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const parsed = createSchema.safeParse(req.body || {});
    if (!parsed.success) throw httpError(400, zodMessage(parsed));

    const fn = resolveServiceFn(['createBook', 'create', 'addBook', 'add']);
    const book = await fn(parsed.data);
    res.status(200).json({ data: book });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = parseId(req);
    const parsed = updateSchema.safeParse(req.body || {});
    if (!parsed.success) throw httpError(400, zodMessage(parsed));

    const changes = {};
    for (const [k, v] of Object.entries(parsed.data)) {
      if (v !== undefined) changes[k] = v;
    }

    const fn = resolveServiceFn(['updateBook', 'update', 'editBook']);
    const book = await fn(id, changes);
    if (!book) throw httpError(404, 'Book not found.');
    res.status(200).json({ data: book });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = parseId(req);
    const fn = resolveServiceFn(['removeBook', 'deleteBook', 'remove', 'delete', 'destroy']);
    const result = await fn(id);
    if (result === false || result === null) throw httpError(404, 'Book not found.');
    const data = result && typeof result === 'object' ? result : { id, deleted: true };
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };