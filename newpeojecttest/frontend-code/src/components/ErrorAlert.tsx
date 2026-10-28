import { useEffect, useState } from 'react';

export type AlertVariant = 'error' | 'success';

export interface ErrorAlertProps {
  /** Message to display. When null/undefined/empty, nothing is rendered. */
  message?: string | null;
  /** Visual variant: red error (default) or green success. */
  variant?: AlertVariant;
  /** Optional title shown above the message. */
  title?: string;
  /**
   * Called when the user dismisses the alert. If provided, the parent is
   * expected to clear the message. If omitted, the alert hides itself locally.
   */
  onDismiss?: () => void;
  /** Whether a dismiss button is shown. Defaults to true. */
  dismissible?: boolean;
  /** Extra classes for the outer container. */
  className?: string;
}

const STYLES: Record<AlertVariant, { box: string; title: string; button: string; icon: string }> = {
  error: {
    box: 'border-red-300 bg-red-50 text-red-800',
    title: 'text-red-900',
    button: 'text-red-700 hover:bg-red-100 focus:ring-red-500',
    icon: 'text-red-500',
  },
  success: {
    box: 'border-green-300 bg-green-50 text-green-800',
    title: 'text-green-900',
    button: 'text-green-700 hover:bg-green-100 focus:ring-green-500',
    icon: 'text-green-500',
  },
};

export default function ErrorAlert({
  message,
  variant = 'error',
  title,
  onDismiss,
  dismissible = true,
  className = '',
}: ErrorAlertProps) {
  const [hidden, setHidden] = useState(false);

  // When a new message arrives, show the alert again even if a previous one was dismissed.
  useEffect(() => {
    setHidden(false);
  }, [message]);

  if (!message || hidden) return null;

  const styles = STYLES[variant];

  const handleDismiss = () => {
    setHidden(true);
    if (onDismiss) onDismiss();
  };

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={`flex items-start gap-3 rounded-md border p-3 text-sm sm:p-4 ${styles.box} ${className}`}
    >
      <span aria-hidden="true" className={`mt-0.5 shrink-0 font-bold ${styles.icon}`}>
        {variant === 'error' ? '!' : '✓'}
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className={`mb-1 font-semibold ${styles.title}`}>{title}</p>}
        <p className="break-words">{message}</p>
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss message"
          className={`-m-1 shrink-0 rounded p-1 leading-none focus:outline-none focus:ring-2 ${styles.button}`}
        >
          <span aria-hidden="true" className="text-lg">
            ×
          </span>
        </button>
      )}
    </div>
  );
}