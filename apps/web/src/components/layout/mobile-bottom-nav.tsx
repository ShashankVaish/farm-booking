'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import styles from './shell.module.css';

const ITEMS = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/explore', label: 'Explore', icon: SearchIcon },
  { href: '/dashboard/trips', label: 'Trips', icon: BagIcon },
  { href: '/dashboard/wishlist', label: 'Wishlist', icon: HeartIcon },
  { href: '/dashboard', label: 'Profile', icon: ProfileIcon },
];

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 9.5 10 4l7 5.5V16H4V9.5Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="9" cy="9" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="m13 13 3.5 3.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="4" y="7" width="12" height="9" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 7V6a3 3 0 0 1 6 0v1" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M10 16s-6-3.7-6-7.2A3.4 3.4 0 0 1 10 6a3.4 3.4 0 0 1 6 2.8C16 12.3 10 16 10 16Z"
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

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.bottomNav} aria-label="Mobile">
      {ITEMS.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(styles.bottomItem, active && styles.bottomItemActive)}
            aria-current={active ? 'page' : undefined}
          >
            <item.icon />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
