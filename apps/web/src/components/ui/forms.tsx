import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import styles from './ui.module.css';

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  success?: string;
  id: string;
};

function describedBy(id: string, error?: string, success?: string, hint?: string) {
  if (error) return `${id}-error`;
  if (success) return `${id}-success`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export function Input({
  label,
  hint,
  error,
  success,
  id,
  className,
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={cn(styles.control, className)}
        {...props}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, error, success, hint)}
      />
      {hint && !error && !success ? (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {success && !error ? (
        <p id={`${id}-success`} className={styles.successText} role="status">
          {success}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className={styles.errorText} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Textarea({
  label,
  hint,
  error,
  success,
  id,
  className,
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className={cn(styles.textarea, className)}
        {...props}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, error, success, hint)}
      />
      {hint && !error && !success ? (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {success && !error ? (
        <p id={`${id}-success`} className={styles.successText} role="status">
          {success}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className={styles.errorText} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Select({
  label,
  hint,
  error,
  success,
  id,
  children,
  className,
  ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className={cn(styles.control, className)}
        {...props}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, error, success, hint)}
      >
        {children}
      </select>
      {hint && !error && !success ? (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {success && !error ? (
        <p id={`${id}-success`} className={styles.successText} role="status">
          {success}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className={styles.errorText} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({
  label,
  id,
  ...props
}: { label: string; id: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={styles.checkRow} htmlFor={id}>
      <input id={id} type="checkbox" {...props} />
      <span className="t-body-small">{label}</span>
    </label>
  );
}

export function Radio({
  label,
  id,
  ...props
}: { label: string; id: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={styles.checkRow} htmlFor={id}>
      <input id={id} type="radio" {...props} />
      <span className="t-body-small">{label}</span>
    </label>
  );
}
