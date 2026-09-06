'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { BrandMark } from '@/components/layout/brand-mark';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import styles from './shell.module.css';

const NAV = [
  { href: '/explore', label: 'Explore' },
  { href: '/stays', label: 'Stays' },
  { href: '/experiences', label: 'Experiences' },
  { href: '/events', label: 'Events' },
];

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M10 16.5s-6-3.7-6-7.2A3.4 3.4 0 0 1 10 6.5a3.4 3.4 0 0 1 6 2.8c0 3.5-6 7.2-6 7.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="7" r="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4.5 16c1.2-2.4 3-3.5 5.5-3.5S14.3 13.6 15.5 16" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function SiteHeader({ variant = 'default' }: { variant?: 'default' | 'minimal' }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className={styles.header}>
      <div className={`container ${styles.headerInner}`}>
        <div className={styles.headerStart}>
          {variant === 'default' ? (
            <button
              type="button"
              className={`${styles.iconButton} ${styles.menuToggle}`}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MenuIcon />
              <span className="visually-hidden">{menuOpen ? 'Close menu' : 'Open menu'}</span>
            </button>
          ) : null}

          <Link href="/" aria-label="Home">
            <BrandMark />
          </Link>
        </div>

        {variant === 'default' ? (
          <nav className={styles.desktopNav} aria-label="Primary">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(styles.navLink, pathname.startsWith(item.href) && styles.navLinkActive)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/host"
              className={cn(styles.navLink, pathname.startsWith('/host') && styles.navLinkActive)}
            >
              List Your Property
            </Link>
          </nav>
        ) : (
          <span />
        )}

        <div className={styles.headerActions}>
          <Link href="/dashboard/wishlist" className={styles.iconButton} aria-label="Wishlist">
            <HeartIcon />
          </Link>
          <Link href="/dashboard" className={styles.iconButton} aria-label="Account">
            <ProfileIcon />
          </Link>
          {variant === 'default' ? (
            <span className={styles.desktopCta}>
              <Button href="/explore" size="sm">
                Find a Stay
              </Button>
            </span>
          ) : null}
        </div>
      </div>

      {menuOpen && variant === 'default' ? (
        <div id="mobile-menu" className={styles.menu}>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={styles.menuLink} onClick={() => setMenuOpen(false)}>
              {item.label}
            </Link>
          ))}
          <Link href="/host" className={styles.menuLink} onClick={() => setMenuOpen(false)}>
            List Your Property
          </Link>
          <Button href="/explore">Find a Stay</Button>
        </div>
      ) : null}
    </header>
  );
}
