import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import styles from './ui.module.css';

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  id: string;
};

export function Input({
  label,
  hint,
  error,
  id,
  className,
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={id}>
        {label}
      </label>
      <input id={id} className={cn(styles.control, className)} aria-invalid={Boolean(error)} {...props} />
      {hint && !error ? <p className={styles.hint}>{hint}</p> : null}
      {error ? <p className={styles.errorText}>{error}</p> : null}
    </div>
  );
}

export function Textarea({
  label,
  hint,
  error,
  id,
  className,
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={id}>
        {label}
      </label>
      <textarea id={id} className={cn(styles.textarea, className)} aria-invalid={Boolean(error)} {...props} />
      {hint && !error ? <p className={styles.hint}>{hint}</p> : null}
      {error ? <p className={styles.errorText}>{error}</p> : null}
    </div>
  );
}

export function Select({
  label,
  hint,
  error,
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
      <select id={id} className={cn(styles.control, className)} aria-invalid={Boolean(error)} {...props}>
        {children}
      </select>
      {hint && !error ? <p className={styles.hint}>{hint}</p> : null}
      {error ? <p className={styles.errorText}>{error}</p> : null}
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
