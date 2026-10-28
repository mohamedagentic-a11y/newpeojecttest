import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { BookInput } from '../types';

interface BookFormProps {
  /** Initial values for the form. Omit (or pass empty strings) for "add" mode. */
  initialValues?: Partial<BookInput>;
  /** Called with trimmed, validated values. May return a promise; errors thrown are shown in the form. */
  onSubmit: (values: BookInput) => void | Promise<void>;
  /** Called when the user cancels the form. */
  onCancel: () => void;
  /** Optional label for the submit button. */
  submitLabel?: string;
}

type FieldErrors = Partial<Record<keyof BookInput, string>>;

const EMPTY: BookInput = { title: '', author: '', isbn: '' };

function normaliseIsbn(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

function isValidIsbnFormat(raw: string): boolean {
  const isbn = normaliseIsbn(raw);
  return /^\d{9}[\dX]$/.test(isbn) || /^\d{13}$/.test(isbn);
}

function validate(values: BookInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.title.trim()) errors.title = 'Title is required.';
  if (!values.author.trim()) errors.author = 'Author is required.';
  if (!values.isbn.trim()) {
    errors.isbn = 'ISBN is required.';
  } else if (!isValidIsbnFormat(values.isbn)) {
    errors.isbn = 'ISBN must be 10 or 13 digits (hyphens and spaces allowed; ISBN-10 may end in X).';
  }
  return errors;
}

function toValues(initial?: Partial<BookInput>): BookInput {
  return {
    title: initial?.title ?? EMPTY.title,
    author: initial?.author ?? EMPTY.author,
    isbn: initial?.isbn ?? EMPTY.isbn,
  };
}

export default function BookForm({ initialValues, onSubmit, onCancel, submitLabel }: BookFormProps) {
  const [values, setValues] = useState<BookInput>(() => toValues(initialValues));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof BookInput, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const initTitle = initialValues?.title;
  const initAuthor = initialValues?.author;
  const initIsbn = initialValues?.isbn;

  // Re-sync when the form is reused for a different book.
  useEffect(() => {
    setValues(toValues({ title: initTitle, author: initAuthor, isbn: initIsbn }));
    setErrors({});
    setTouched({});
    setSubmitError(null);
  }, [initTitle, initAuthor, initIsbn]);

  const isEdit = Boolean(initTitle || initAuthor || initIsbn);
  const label = submitLabel ?? (isEdit ? 'Save changes' : 'Add book');

  const handleChange = (field: keyof BookInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...values, [field]: e.target.value };
    setValues(next);
    if (touched[field]) {
      setErrors(validate(next));
    }
  };

  const handleBlur = (field: keyof BookInput) => () => {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors(validate(values));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    const found = validate(values);
    setErrors(found);
    setTouched({ title: true, author: true, isbn: true });
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit({
        title: values.title.trim(),
        author: values.author.trim(),
        isbn: values.isbn.trim(),
      });
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'Could not save the book. Please try again.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (field: keyof BookInput) =>
    `mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 ${
      touched[field] && errors[field]
        ? 'border-red-500 focus:ring-red-400'
        : 'border-gray-300 focus:ring-blue-400'
    }`;

  const fields: { key: keyof BookInput; label: string; placeholder: string }[] = [
    { key: 'title', label: 'Title', placeholder: 'e.g. React Up and Running' },
    { key: 'author', label: 'Author', placeholder: 'e.g. Stoyan Stefanov' },
    { key: 'isbn', label: 'ISBN', placeholder: 'e.g. 978-1-4920-5146-5' },
  ];

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {fields.map(({ key, label: fieldLabel, placeholder }) => (
        <div key={key}>
          <label htmlFor={`book-${key}`} className="block text-sm font-medium text-gray-700">
            {fieldLabel} <span className="text-red-500">*</span>
          </label>
          <input
            id={`book-${key}`}
            name={key}
            type="text"
            value={values[key]}
            onChange={handleChange(key)}
            onBlur={handleBlur(key)}
            placeholder={placeholder}
            disabled={submitting}
            aria-invalid={Boolean(touched[key] && errors[key])}
            aria-describedby={touched[key] && errors[key] ? `book-${key}-error` : undefined}
            className={inputClass(key)}
          />
          {touched[key] && errors[key] && (
            <p id={`book-${key}-error`} className="mt-1 text-xs text-red-600">
              {errors[key]}
            </p>
          )}
        </div>
      ))}

      {submitError && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {submitError}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Saving…' : label}
        </button>
      </div>
    </form>
  );
}