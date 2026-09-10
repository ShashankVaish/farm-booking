import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Contrast is checked against the shipped token file, not a copy of the values,
 * so the palette cannot drift out of WCAG AA without a test failing.
 */
const css = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8');

function token(name: string): string {
  const match = css.match(new RegExp(`\\s${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  if (!match) throw new Error(`Token ${name} not found or not a plain hex value`);
  return match[1];
}

function channels(hex: string): [number, number, number] {
  const v = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function hue(hex: string): number {
  const [r, g, b] = channels(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return ((h * 60) % 360 + 360) % 360;
}

function hueGap(a: string, b: string): number {
  const d = Math.abs(hue(a) - hue(b)) % 360;
  return Math.min(d, 360 - d);
}

const LAYERS = [
  '--color-background',
  '--color-sunken',
  '--color-surface',
  '--color-surface-elevated',
  '--color-overlay-surface',
];

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

describe('brand constants match the logo asset', () => {
  it('uses the exact coral, cream and base', () => {
    expect(token('--brand-coral').toLowerCase()).toBe('#ff5a60');
    expect(token('--brand-cream').toLowerCase()).toBe('#f1e5dd');
    expect(token('--brand-base').toLowerCase()).toBe('#0d0c10');
  });
});

describe('text tiers clear AA on every background layer', () => {
  for (const tier of ['--color-text-primary', '--color-text-secondary', '--color-text-muted']) {
    for (const layer of LAYERS) {
      it(`${tier} on ${layer}`, () => {
        expect(contrast(token(tier), token(layer))).toBeGreaterThanOrEqual(AA_TEXT);
      });
    }
  }
});

describe('coral', () => {
  it('is legible as text on dark via the dedicated text token', () => {
    for (const layer of LAYERS.slice(0, 4)) {
      expect(contrast(token('--color-primary-text'), token(layer))).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('uses dark ink on a fill, because white on this coral fails AA', () => {
    const fill = token('--color-primary');
    expect(contrast('#ffffff', fill)).toBeLessThan(AA_TEXT); // documents why not white
    expect(contrast(token('--color-on-primary'), fill)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('keeps ink legible across hover and pressed fills', () => {
    for (const fill of ['--color-primary-hover', '--color-primary-press']) {
      expect(contrast(token('--color-on-primary'), token(fill))).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('stands out as a fill against the page', () => {
    expect(contrast(token('--color-primary'), token('--color-background'))).toBeGreaterThanOrEqual(
      AA_NON_TEXT,
    );
  });
});

describe('semantic colours are legible and not confusable with coral', () => {
  for (const name of ['--color-success', '--color-warning', '--color-error', '--color-info']) {
    it(`${name} clears AA as text`, () => {
      for (const layer of LAYERS.slice(0, 4)) {
        expect(contrast(token(name), token(layer))).toBeGreaterThanOrEqual(AA_TEXT);
      }
    });
  }

  it('separates error from the brand coral by hue, not just lightness', () => {
    // A red-on-red error would read as a brand highlight. Coral sits at ~358deg.
    expect(hueGap(token('--color-error'), token('--color-primary'))).toBeGreaterThanOrEqual(15);
  });

  it('keeps success, warning and error apart from each other', () => {
    expect(hueGap(token('--color-success'), token('--color-warning'))).toBeGreaterThanOrEqual(60);
    expect(hueGap(token('--color-success'), token('--color-error'))).toBeGreaterThanOrEqual(60);
    expect(hueGap(token('--color-warning'), token('--color-error'))).toBeGreaterThanOrEqual(60);
  });
});

describe('focus and control borders meet non-text contrast', () => {
  it('the light focus ring is visible on every dark layer', () => {
    for (const layer of LAYERS) {
      expect(contrast(token('--color-focus'), token(layer))).toBeGreaterThanOrEqual(AA_NON_TEXT);
    }
  });

  it('has a dark focus ring for use on a coral fill, where the light one fails', () => {
    expect(contrast(token('--color-focus'), token('--color-primary'))).toBeLessThan(AA_NON_TEXT);
    expect(
      contrast(token('--color-focus-on-primary'), token('--color-primary')),
    ).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it('outlines interactive controls at 3:1 on every layer', () => {
    for (const layer of LAYERS) {
      expect(contrast(token('--color-border-control'), token(layer))).toBeGreaterThanOrEqual(
        AA_NON_TEXT,
      );
    }
  });
});
