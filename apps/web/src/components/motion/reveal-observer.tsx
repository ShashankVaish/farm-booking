'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/*
  Scroll-reveal for the whole site, driven by a data attribute.

  Any element — server-rendered or not — opts in with `data-reveal`, and a grid
  can stagger its children with `style={{ '--reveal-i': index }}`. This one
  component watches for them; pages carry no animation code of their own.

  Three rules keep it from ever hiding content:
    1. Nothing is hidden until this has run. The `motion-ready` class on <html>
       is what the CSS keys off, so without JavaScript every element shows.
    2. Whatever is already on screen when it runs is marked visible first, so
       the top of the page never flickers out and back in.
    3. Visitors who ask their device for reduced motion see everything at once.
*/
export function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const pending = () => Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-visible)'));

    if (reduce || typeof IntersectionObserver === 'undefined') {
      pending().forEach((element) => element.classList.add('is-visible'));
      return;
    }

    const inView = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      return rect.top < window.innerHeight && rect.bottom > 0;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );

    const track = () => {
      for (const element of pending()) {
        if (!root.classList.contains('motion-ready') && inView(element)) {
          // First pass: already on screen, so never hide it or replay it.
          element.classList.add('is-visible', 'reveal-instant');
        } else {
          observer.observe(element);
        }
      }
    };

    track();
    root.classList.add('motion-ready');

    // Content that arrives later (client navigation, lazy sections) opts in too.
    const mutations = new MutationObserver(() => track());
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [pathname]);

  return null;
}
