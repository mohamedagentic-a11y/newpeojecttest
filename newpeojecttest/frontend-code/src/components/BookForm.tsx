import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { BookInput } from '../types';

interface BookFormProps {
  initial?: BookInput;
  onSubmit: (input: BookInput) => void | Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

type FieldErrors = Partial<Record<keyof BookInput, string>>;

const EMPTY: BookInput = { title: '', author: '', isbn: '' };

function isValidIsbn(raw: string): boolean {
  const isbn = raw.replace(/[-\s]/g, '');
  if (/^\d{9}[\dXx]$/.test(isbn)) {
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      const ch = isbn[i];
      const val = ch === 'X' || ch === 'x' ? 10 : Number(ch);
      sum += val * (10 - i);
    }
    return sum % 11 === 0;
  }
  if (/^\d{13}$/.test(isbn)) {
    let sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
    }
    return sum % 10 === 0;
  }
  return false;
}

function validate(values: BookInput): FieldErrors {
  const errors: FieldErrors = {};
  const title = values.title.trim();
  const author = values.author.trim();
  const isbn = values.isbn.trim();
  if (!title) errors.title = 'Title is required.';
  else if (title.length > 255) errors.title = 'Title must be 255 characters or fewer.';
  if (!author) errors.author = 'Author is required.';
  else if (author.length > 255) errors.author = 'Author must be 255 characters or fewer.';
  if (!isbn) errors.isbn = 'ISBN is required.';
  else if (!isValidIsbn(isbn)) errors.isbn = 'Enter a valid ISBN-10 or ISBN-13.';
  return errors;
}

export default function BookForm({ initial, onSubmit, onCancel, submitLabel }: BookFormProps) {
  const [values, setValues] = useState<BookInput>(initial ?? EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof BookInput, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setValues(initial ?? EMPTY);
    setErrors({});
    setTouched({});
    setSubmitError(null);
  }, [initial]);

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
    const found = validate(values);
    setErrors(found);
    setTouched({ title: true, author: true, isbn: true });
    if (Object.keys(found).length > 0) return;
    setSubmitting(true);
    setSubmitError(null);
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

  const renderField = (field: keyof BookInput, label: string, placeholder: string, extraClass = '') => (
    <div className={extraClass}>
      <label htmlFor={`book-${field}`} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={`book-${field}`}
        name={field}
        type="text"
        value={values[field]}
        onChange={handleChange(field)}
        onBlur={handleBlur(field)}
        placeholder={placeholder}
        disabled={submitting}
        aria-invalid={Boolean(touched[field] && errors[field])}
        aria-describedby={touched[field] && errors[field] ? `book-${field}-error` : undefined}
        className={inputClass(field)}
      />
      {touched[field] && errors[field] && (
        <p id={`book-${field}-error`} className="mt-1 text-xs text-red-600">
          {errors[field]}
        </p>
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 w-full">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {renderField('title', 'Title', 'e.g. React Up and Running', 'md:col-span-2')}
        {renderField('author', 'Author', 'e.g. Stoyan Stefanov')}
        {renderField('isbn', 'ISBN', 'e.g. 978-1-4919-3171-1')}
      </div>

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
          className="w-full sm:w-auto rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}