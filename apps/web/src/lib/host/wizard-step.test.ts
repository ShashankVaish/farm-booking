import { describe, expect, it } from 'vitest';
import { WIZARD_STEPS } from './listing-types';
import { clampStep, listingEditUrl, parseStepParam } from './wizard-step';

const LAST = WIZARD_STEPS.length - 1;

describe('clampStep', () => {
  it('keeps a step that exists', () => {
    expect(clampStep(0)).toBe(0);
    expect(clampStep(4)).toBe(4);
    expect(clampStep(LAST)).toBe(LAST);
  });

  it('pulls a step back inside the wizard', () => {
    expect(clampStep(-3)).toBe(0);
    expect(clampStep(LAST + 10)).toBe(LAST);
  });

  it('refuses to produce a fractional step', () => {
    expect(clampStep(2.9)).toBe(2);
  });

  // Not finite is not a step at all, so it starts the host at the beginning
  // rather than guessing at an end — the same rule parseStepParam documents.
  it('starts at the beginning for a step that is not a number', () => {
    expect(clampStep(Number.NaN)).toBe(0);
    expect(clampStep(Number.POSITIVE_INFINITY)).toBe(0);
    expect(parseStepParam('Infinity')).toBe(0);
  });
});

describe('parseStepParam', () => {
  it('reads a step out of the query string', () => {
    expect(parseStepParam('5')).toBe(5);
  });

  it('opens at the first step when the parameter is unusable', () => {
    for (const raw of [undefined, null, '', '   ', 'photos', '1e674d62']) {
      expect(parseStepParam(raw)).toBe(0);
    }
  });

  it('takes the first value when the parameter is repeated', () => {
    expect(parseStepParam(['3', '7'])).toBe(3);
  });

  it('clamps a step past the end of the wizard', () => {
    expect(parseStepParam(String(LAST + 4))).toBe(LAST);
  });
});

describe('listingEditUrl', () => {
  /*
    This is the regression: the first save used to redirect without a step, so
    the remounted wizard opened on Basics however far along the host was.
  */
  it('carries the step the host is moving to', () => {
    expect(listingEditUrl('abc-123', 4)).toBe('/host/properties/abc-123/edit?step=4');
  });

  it('round-trips through the query string it writes', () => {
    for (let step = 0; step <= LAST; step += 1) {
      const url = new URL(listingEditUrl('abc-123', step), 'https://baagly.com');
      expect(parseStepParam(url.searchParams.get('step'))).toBe(step);
    }
  });

  it('never writes a step the wizard cannot show', () => {
    expect(listingEditUrl('abc-123', 99)).toBe(`/host/properties/abc-123/edit?step=${LAST}`);
    expect(listingEditUrl('abc-123', -1)).toBe('/host/properties/abc-123/edit?step=0');
  });
});
