import { describe, expect, it } from 'vitest';
import {
  termsBySlug,
  GUEST_TERMS,
  HOST_TERMS,
  TERMS_DOCUMENTS,
  type TermsDocument,
} from '@/lib/legal/terms-content';

/*
  These documents are edited by hand whenever the policy changes, and a mistake
  in them is invisible — a duplicated anchor silently breaks a contents link, an
  out-of-order number reads as a missing clause. The checks below are the guard
  rails for that editing, not a test of any behaviour.
*/

describe.each([
  ['guest', GUEST_TERMS],
  ['host', HOST_TERMS],
])('%s terms', (_name, document: TermsDocument) => {
  it('numbers its sections from 1 with no gaps', () => {
    expect(document.sections.map((section) => section.number)).toEqual(
      document.sections.map((_, index) => index + 1),
    );
  });

  it('gives every section a unique anchor', () => {
    // A duplicate id makes one contents link jump to the wrong clause.
    const ids = document.sections.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses anchors that are valid URL fragments', () => {
    for (const section of document.sections) {
      expect(section.id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('has a title and at least one block in every section', () => {
    for (const section of document.sections) {
      expect(section.title.trim().length).toBeGreaterThan(0);
      expect(section.blocks.length).toBeGreaterThan(0);
    }
  });

  it('never renders an empty list or a blank clause', () => {
    for (const section of document.sections) {
      for (const block of section.blocks) {
        if (block.kind === 'list') {
          expect(block.items.length).toBeGreaterThan(0);
          for (const item of block.items) {
            expect(item.trim().length).toBeGreaterThan(0);
          }
        } else {
          expect(block.text.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('carries the legal-review disclaimer', () => {
    // The client's draft is explicit that these need a lawyer before launch.
    expect(document.important).toContain('reviewed by a qualified legal professional');
  });

  it('states the standard check-in and check-out times', () => {
    const notes = document.sections
      .flatMap((section) => section.blocks)
      .filter((block) => block.kind === 'note')
      .map((block) => (block.kind === 'note' ? block.text : ''));

    expect(notes).toContain('Standard Check-In: 2:00 PM onwards');
    expect(notes).toContain('Standard Check-Out: By 11:00 AM');
  });

  it('ends with the non-negotiable responsibilities', () => {
    const last = document.sections.at(-1);
    expect(last?.title).toContain('Non-Negotiable Responsibilities');
    expect(last?.blocks.at(-1)).toMatchObject({ kind: 'closing' });
  });
});

describe('document set', () => {
  it('covers both audiences exactly once', () => {
    expect(TERMS_DOCUMENTS.map((document) => document.slug)).toEqual(['guest', 'host']);
  });

  it('keeps the two documents distinct', () => {
    // They were transcribed from separate PDFs; pasting one over the other is
    // the obvious way for this to go wrong.
    expect(GUEST_TERMS.title).not.toBe(HOST_TERMS.title);
    expect(GUEST_TERMS.sections.length).toBe(16);
    expect(HOST_TERMS.sections.length).toBe(15);
  });

  it('addresses each document to its own audience', () => {
    expect(GUEST_TERMS.subtitle).toContain('Guests');
    expect(HOST_TERMS.subtitle).toContain('Hosts');
  });
});

describe('termsBySlug', () => {
  it('finds each document', () => {
    expect(termsBySlug('guest')).toBe(GUEST_TERMS);
    expect(termsBySlug('host')).toBe(HOST_TERMS);
  });

  it('returns null for anything else', () => {
    expect(termsBySlug('admin')).toBeNull();
    expect(termsBySlug('')).toBeNull();
  });
});
