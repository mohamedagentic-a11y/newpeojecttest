import { useEffect, useState } from 'react';

export type AlertVariant = 'error' | 'success' | 'info';

export interface ErrorAlertProps {
  /** Message to display. When empty/null/undefined, nothing is rendered. */
  message?: string | null;
  /** Visual style of the alert. Defaults to 'error'. */
  variant?: AlertVariant;
  /** Optional heading shown above the message. */
  title?: string;
  /**
   * Called when the user dismisses the alert. If provided, the parent is
   * expected to clear the message. If omitted, the alert hides itself locally
   * until the message changes.
   */
  onDismiss?: () => void;
  /** Automatically dismiss after this many milliseconds (optional). */
  autoDismissMs?: number;
  className?: string;
}

const variantStyles: Record<AlertVariant, { container: string; button: string; icon: string }> = {
  error: {
    container: 'border-red-300 bg-red-50 text-red-800',
    button: 'text-red-700 hover:bg-red-100 focus:ring-red-400',
    icon: '⚠',
  },
  success: {
    container: 'border-green-300 bg-green-50 text-green-800',
    button: 'text-green-700 hover:bg-green-100 focus:ring-green-400',
    icon: '✓',
  },
  info: {
    container: 'border-blue-300 bg-blue-50 text-blue-800',
    button: 'text-blue-700 hover:bg-blue-100 focus:ring-blue-400',
    icon: 'ℹ',
  },
};

export default function ErrorAlert({
  message,
  variant = 'error',
  title,
  onDismiss,
  autoDismissMs,
  className = '',
}: ErrorAlertProps) {
  const [hidden, setHidden] = useState(false);

  // Re-show the alert whenever a new message arrives.
  useEffect(() => {
    setHidden(false);
  }, [message, variant]);

  const dismiss = () => {
    setHidden(true);
    if (onDismiss) onDismiss();
  };

  useEffect(() => {
    if (!message || hidden || !autoDismissMs || autoDismissMs <= 0) return;
    const timer = window.setTimeout(() => {
      setHidden(true);
      if (onDismiss) onDismiss();
    }, autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [message, hidden, autoDismissMs, onDismiss]);

  if (!message || hidden) return null;

  const styles = variantStyles[variant];

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={`flex w-full items-start gap-3 rounded-md border px-4 py-3 text-sm shadow-sm ${styles.container} ${className}`}
    >
      <span aria-hidden="true" className="mt-0.5 text-base leading-none">
        {styles.icon}
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <p className="break-words">{message}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss message"
        className={`-mr-1 -mt-1 rounded p-1 leading-none focus:outline-none focus:ring-2 ${styles.button}`}
      >
        <span aria-hidden="true" className="text-lg">
          ×
        </span>
      </button>
    </div>
  );
}