/*
  Runs in <head> before the page paints, so the page never flashes the wrong
  theme. The visitor's saved choice wins; with none saved, their device's
  light/dark setting decides. Kept tiny and dependency-free on purpose: it is
  inlined into every page as a string.
*/
export const THEME_STORAGE_KEY = 'baagly-theme';

export const themeScript = `(function(){try{var k='${THEME_STORAGE_KEY}';var t=localStorage.getItem(k);if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;
