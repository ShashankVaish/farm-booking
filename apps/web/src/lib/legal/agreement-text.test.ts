import { describe, expect, it } from 'vitest';
import { parseAgreementText } from '@/lib/legal/agreement-text';

describe('parseAgreementText', () => {
  it('turns the admin conventions into blocks', () => {
    const blocks = parseAgreementText(
      '## 1. Bookings\n- honour every booking\n- keep the calendar accurate\n\nA paragraph\nthat wraps.\n\n## 2. Payouts\nAfter check-in.',
    );
    expect(blocks).toEqual([
      { kind: 'heading', text: '1. Bookings' },
      { kind: 'list', items: ['honour every booking', 'keep the calendar accurate'] },
      { kind: 'paragraph', text: 'A paragraph that wraps.' },
      { kind: 'heading', text: '2. Payouts' },
      { kind: 'paragraph', text: 'After check-in.' },
    ]);
  });

  it('never produces markup from the text', () => {
    // An admin pasting HTML gets literal text, not tags, in a signed document.
    const blocks = parseAgreementText('<script>alert(1)</script>');
    expect(blocks).toEqual([{ kind: 'paragraph', text: '<script>alert(1)</script>' }]);
  });

  it('copes with Windows line endings and stray blank lines', () => {
    expect(parseAgreementText('\r\n\r\n## A\r\n\r\n- x\r\n\r\n')).toEqual([
      { kind: 'heading', text: 'A' },
      { kind: 'list', items: ['x'] },
    ]);
  });
});
