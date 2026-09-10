import { describe, expect, it } from 'vitest';
import { photoAlt } from './photo-alt';

describe('photoAlt', () => {
  it('replaces the filenames actually stored against the doggy-farm listing', () => {
    // Read straight out of the images table — every one of these was being
    // announced to screen readers and printed across the hero.
    for (const filename of ['IMAGE 2025-06-12 AT 21.12.54_30A7A4D5', 'sign', 'sign1', 'sign (1)', 'photo']) {
      expect(photoAlt(filename, 'doggy farm', 2)).toBe('doggy farm — photo 2');
    }
  });

  it('replaces camera and messenger filenames', () => {
    for (const filename of [
      'WhatsApp Image 2025-06-12 at 21.12.54',
      'IMG_2043',
      'DSC_0091',
      'PXL_20240811_101500',
      'Screenshot 2025-01-02 at 10.11.12',
      'lawn-at-dusk.jpg',
      'pool.HEIC',
      'front gate.png',
    ]) {
      expect(photoAlt(filename, 'doggy farm', 3)).toBe('doggy farm — photo 3');
    }
  });

  it('falls back when alt text is missing or blank', () => {
    expect(photoAlt(null, 'Sambhal Garden', 1)).toBe('Sambhal Garden — photo 1');
    expect(photoAlt(undefined, 'Sambhal Garden', 1)).toBe('Sambhal Garden — photo 1');
    expect(photoAlt('   ', 'Sambhal Garden', 1)).toBe('Sambhal Garden — photo 1');
  });

  it('keeps alt text a host actually wrote', () => {
    expect(photoAlt('Sunset over the pool deck', 'doggy farm', 3)).toBe('Sunset over the pool deck');
    expect(photoAlt('Main lawn seen from the terrace', 'doggy farm', 4)).toBe(
      'Main lawn seen from the terrace',
    );
    // "Image" only triggers the camera rule as a leading token followed by a
    // separator, so ordinary prose that merely starts similarly survives.
    expect(photoAlt('Imagine Lawn, west side', 'doggy farm', 5)).toBe('Imagine Lawn, west side');
  });
});
