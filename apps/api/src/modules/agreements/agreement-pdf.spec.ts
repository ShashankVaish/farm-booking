import {
  pdfFileName,
  renderAgreementPdf,
  toWinAnsi,
  type SignedAgreement,
} from './agreement-pdf';
import { parseAgreementBlocks } from './agreement-text';

const signed: SignedAgreement = {
  agreement: {
    version: 5,
    title: 'Host Agreement',
    body: '## 1. Bookings\n- You will honour every confirmed booking — at the price shown.\n\nA closing paragraph.',
    publishedAt: new Date('2026-09-23T06:00:00Z'),
  },
  acceptance: {
    signatureName: 'Asha Kulkarni',
    acceptedAt: new Date('2026-09-24T09:30:00Z'),
    ipAddress: '49.36.12.7',
    userAgent: 'Mozilla/5.0 (iPhone)',
  },
  host: { name: 'Asha Kulkarni', email: 'asha@example.com' },
  property: { id: 'p-123', title: 'Lake House', city: 'Lonavala', state: 'Maharashtra' },
  platform: {
    entity: 'Shubh Gupta, sole proprietor trading as Shubh Traders',
    gstin: '09EANPG5213E1ZT',
    address: 'Sambhal, Uttar Pradesh 244302, India',
    brandName: 'Baagly',
  },
};

describe('toWinAnsi', () => {
  /*
    pdfkit's built-in fonts encode WinAnsi. A character outside it is drawn as
    nothing at all, so a rupee amount would silently vanish from a contract.
  */
  it('keeps the em dash, which WinAnsi has', () => {
    expect(toWinAnsi('price — shown')).toBe('price — shown');
  });

  it('spells out the rupee sign, which WinAnsi lacks', () => {
    expect(toWinAnsi('₹12,000 per night')).toBe('Rs.12,000 per night');
  });

  it('flattens smart punctuation an admin may paste from a word processor', () => {
    expect(toWinAnsi('“the Host’s” fee…')).toBe('"the Host\'s" fee...');
  });

  it('strips zero-width characters and normalises non-breaking spaces', () => {
    expect(toWinAnsi('a​b c')).toBe('ab c');
  });

  it('marks anything still unencodable rather than dropping it silently', () => {
    // A reader must be able to see that something was lost.
    expect(toWinAnsi('fee 元')).toBe('fee ?');
  });
});

describe('pdfFileName', () => {
  it('names the file by version, listing and date', () => {
    expect(pdfFileName(signed)).toBe('host-agreement-v5-lake-house-2026-09-24.pdf');
  });

  it('copes with a title that has no usable characters', () => {
    expect(pdfFileName({ ...signed, property: { ...signed.property, title: '!!!' } })).toBe(
      'host-agreement-v5-listing-2026-09-24.pdf',
    );
  });
});

describe('renderAgreementPdf', () => {
  it('produces a real PDF', async () => {
    const pdf = await renderAgreementPdf(signed);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.subarray(-6).toString()).toContain('%%EOF');
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('puts the signature on its own page, after the agreement', async () => {
    // The evidence must never be split across a page break.
    const pdf = await renderAgreementPdf(signed);
    const pages = pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(pages.length).toBeGreaterThanOrEqual(2);
  });

  it('renders every block of the agreement text', () => {
    // The parser feeding the PDF must see the same structure the host read.
    expect(parseAgreementBlocks(signed.agreement.body)).toEqual([
      { kind: 'heading', text: '1. Bookings' },
      { kind: 'list', items: ['You will honour every confirmed booking — at the price shown.'] },
      { kind: 'paragraph', text: 'A closing paragraph.' },
    ]);
  });

  it('does not fall over when the IP and device were not recorded', async () => {
    const pdf = await renderAgreementPdf({
      ...signed,
      acceptance: { ...signed.acceptance, ipAddress: null, userAgent: null },
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('renders a long agreement across pages without throwing', async () => {
    const long = Array.from({ length: 60 }, (_, i) => `## ${i + 1}. Clause\n- ${'text '.repeat(40)}`).join('\n\n');
    const pdf = await renderAgreementPdf({ ...signed, agreement: { ...signed.agreement, body: long } });
    expect(pdf.length).toBeGreaterThan(5000);
  });
});
