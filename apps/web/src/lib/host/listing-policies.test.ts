import { describe, expect, it } from 'vitest';
import {
  canonicalPolicy,
  policyOptions,
  selectedPolicy,
  PET_OPTIONS,
  SMOKING_OPTIONS,
} from '@/lib/host/listing-policies';

describe('canonicalPolicy', () => {
  it('matches an exact option', () => {
    expect(canonicalPolicy(SMOKING_OPTIONS, 'Not allowed')).toBe('Not allowed');
  });

  it('folds the lowercase values real listings already hold', () => {
    // Three live listings were saved with a free-typed "allowed".
    expect(canonicalPolicy(SMOKING_OPTIONS, 'allowed')).toBe('Allowed');
    expect(canonicalPolicy(SMOKING_OPTIONS, '  ALLOWED ')).toBe('Allowed');
  });

  it('returns null for a value that is genuinely not an option', () => {
    expect(canonicalPolicy(SMOKING_OPTIONS, 'Only on the terrace after 9pm')).toBeNull();
  });

  it('treats blank and missing as no value', () => {
    expect(canonicalPolicy(SMOKING_OPTIONS, '')).toBeNull();
    expect(canonicalPolicy(SMOKING_OPTIONS, '   ')).toBeNull();
    expect(canonicalPolicy(SMOKING_OPTIONS, null)).toBeNull();
    expect(canonicalPolicy(SMOKING_OPTIONS, undefined)).toBeNull();
  });
});

describe('policyOptions', () => {
  it('is just the options when the stored value is one of them', () => {
    expect(policyOptions(SMOKING_OPTIONS, 'Allowed')).toEqual([...SMOKING_OPTIONS]);
    // Case folding means a lowercase value does not add a duplicate entry.
    expect(policyOptions(SMOKING_OPTIONS, 'allowed')).toEqual([...SMOKING_OPTIONS]);
  });

  it('keeps custom text a host wrote before this was a dropdown', () => {
    // Dropping it would silently rewrite a policy the host never changed.
    const options = policyOptions(SMOKING_OPTIONS, 'Only on the terrace');
    expect(options).toHaveLength(SMOKING_OPTIONS.length + 1);
    expect(options.at(-1)).toBe('Only on the terrace');
  });

  it('does not add an empty entry for a blank value', () => {
    expect(policyOptions(PET_OPTIONS, '')).toEqual([...PET_OPTIONS]);
  });
});

describe('selectedPolicy', () => {
  it('selects the canonical spelling for a stored variant', () => {
    expect(selectedPolicy(SMOKING_OPTIONS, 'allowed')).toBe('Allowed');
  });

  it('selects custom text unchanged', () => {
    expect(selectedPolicy(SMOKING_OPTIONS, 'Only on the terrace')).toBe('Only on the terrace');
  });

  it('falls back to the safest option when nothing is stored', () => {
    // "Not allowed" is first in both lists on purpose: a new listing should
    // default to the restrictive answer, not the permissive one.
    expect(selectedPolicy(SMOKING_OPTIONS, '')).toBe('Not allowed');
    expect(selectedPolicy(PET_OPTIONS, null)).toBe('Not allowed');
  });
});
