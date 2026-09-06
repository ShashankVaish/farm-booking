import type { ReactNode } from 'react';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import styles from './shell.module.css';

export function SiteShell({
  children,
  variant = 'default',
}: {
  children: ReactNode;
  variant?: 'default' | 'minimal';
}) {
  return (
    <div className={styles.shell}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader variant={variant} />
      <main id="main" className={variant === 'minimal' ? styles.mainMinimal : styles.main}>
        {children}
      </main>
      <SiteFooter />
      {variant === 'default' ? <MobileBottomNav /> : null}
    </div>
  );
}
