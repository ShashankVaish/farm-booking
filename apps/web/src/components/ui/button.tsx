import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import styles from './ui.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variantClass: Record<Variant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  ghost: styles.ghost,
  accent: styles.accent,
  danger: styles.danger,
};

const sizeClass: Record<Size, string | undefined> = {
  sm: styles.sm,
  md: undefined,
  lg: styles.lg,
};

type Shared = {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  className?: string;
};

type ButtonAsButton = Shared &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
    href?: undefined;
  };

type ButtonAsLink = Shared & {
  href: string;
};

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const variant = props.variant ?? 'primary';
  const size = props.size ?? 'md';
  const classNames = cn(styles.button, variantClass[variant], sizeClass[size], props.block && styles.block, props.className);

  if ('href' in props && props.href) {
    return (
      <Link href={props.href} className={classNames}>
        {props.children}
      </Link>
    );
  }

  const buttonProps = props as ButtonAsButton;

  return (
    <button
      type={buttonProps.type ?? 'button'}
      className={classNames}
      disabled={buttonProps.disabled}
      name={buttonProps.name}
      value={buttonProps.value}
      onClick={buttonProps.onClick}
      id={buttonProps.id}
      form={buttonProps.form}
      aria-label={buttonProps['aria-label']}
    >
      {buttonProps.children}
    </button>
  );
}
