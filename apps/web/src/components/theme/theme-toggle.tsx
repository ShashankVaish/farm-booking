'use client';

import { useEffect, useState } from 'react';
import { THEME_STORAGE_KEY } from './theme-script';

type Theme = 'light' | 'dark';

function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

/**
 * Switches between light and dark, remembers the choice, and follows the
 * device setting until the visitor makes one.
 */
export function ThemeToggle({ className }: { className?: string }) {
  // Rendered as dark on the server; corrected on mount, before anyone can tap it.
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    setTheme(currentTheme());

    // No saved choice yet: keep following the device as it changes.
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(THEME_STORAGE_KEY);
      } catch {
        // storage blocked; follow the device
      }
      if (saved === 'light' || saved === 'dark') return;
      const next: Theme = media.matches ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      setTheme(next);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    // A brief class lets colours cross-fade instead of snapping.
    root.classList.add('theme-transition');
    root.setAttribute('data-theme', next);
    window.setTimeout(() => root.classList.remove('theme-transition'), 400);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // storage blocked: the switch still applies for this visit
    }
    setTheme(next);
  }

  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button type="button" className={className} onClick={toggle} aria-label={label} title={label}>
      {theme === 'dark' ? (
        // Sun: tapping it brings the light.
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
        </svg>
      ) : (
        // Moon.
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
