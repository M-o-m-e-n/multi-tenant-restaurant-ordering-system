import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

/** Labelled input in the modal style: small uppercase label, filled dark field. */
export function Field({ label, error, className = '', ...input }: Props) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-xs font-medium uppercase tracking-wider text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="min-h-11 rounded-icon border border-line-strong bg-bg px-3.5 text-sm text-ink placeholder:text-ink-muted/60 focus:border-flame-light"
        {...input}
      />
      {error && (
        <p id={errorId} className="text-xs text-flame-text">
          {error}
        </p>
      )}
    </div>
  );
}
