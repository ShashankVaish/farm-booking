import PDFDocument from 'pdfkit';
import { parseAgreementBlocks } from './agreement-text';

/*
  Renders a signed host agreement as a PDF.

  The point of the file is evidence: it has to show the exact text the host
  read, who signed it, when, from where, and for which property — so that it
  stands on its own if a dispute, an audit or a payment gateway asks for it
  months later. Everything on the page comes from the stored acceptance row;
  nothing is recomputed at render time.

  pdfkit's built-in Times family is used rather than an embedded font. Those
  fonts encode WinAnsi, which covers everything an English agreement needs
  including the em dash, and shipping no font binary keeps the API image small
  and the output byte-identical across machines. `toWinAnsi` handles the
  handful of characters an admin might paste that WinAnsi lacks.
*/

const PAGE_MARGIN = 56;
const RULE_COLOUR = '#c9c2bb';
const MUTED = '#5c5560';
const INK = '#141218';

/**
 * Characters outside WinAnsi, mapped to something a reader loses nothing by.
 *
 * The rupee sign is the one that matters in practice: it was introduced long
 * after the encoding, so a built-in PDF font cannot draw it and pdfkit would
 * emit a blank. "Rs." is unambiguous and is what Indian contracts used before
 * the symbol existed.
 */
const REPLACEMENTS: Array<[RegExp, string]> = [
  [/₹/g, 'Rs.'],
  [/[‘’‛]/g, "'"],
  [/[“”]/g, '"'],
  [/…/g, '...'],
  [/[−‒–]/g, '-'],
  [/ /g, ' '],
  [/[​-‍﻿]/g, ''],
];

export function toWinAnsi(value: string): string {
  let out = value;
  for (const [pattern, replacement] of REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  // Anything still unencodable becomes a question mark rather than a blank, so
  // a reader can see that something was lost instead of silently missing it.
  return out.replace(/[^\u0000-ÿ—]/g, '?');
}

export type SignedAgreement = {
  agreement: { version: number; title: string; body: string; publishedAt: Date };
  acceptance: {
    signatureName: string;
    acceptedAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  };
  host: { name: string; email: string };
  property: { title: string; city: string; state: string; id: string };
  platform: { entity: string; gstin: string; address: string; brandName: string };
};

/** IST, because the signature happened in India and the reader is there too. */
function formatIst(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

/**
 * The file name a browser saves. Includes the property and the version so a
 * folder of these stays sortable and unambiguous.
 */
export function pdfFileName(signed: SignedAgreement): string {
  const slug = signed.property.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const day = signed.acceptance.acceptedAt.toISOString().slice(0, 10);
  return `host-agreement-v${signed.agreement.version}-${slug || 'listing'}-${day}.pdf`;
}

export function renderAgreementPdf(signed: SignedAgreement): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
    info: {
      Title: `${signed.agreement.title} v${signed.agreement.version} — ${signed.property.title}`,
      Author: signed.platform.entity,
      Subject: 'Host agreement, signed electronically',
      CreationDate: signed.acceptance.acceptedAt,
    },
  });

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const width = doc.page.width - PAGE_MARGIN * 2;
  const text = (value: string) => toWinAnsi(value);

  // --- Header --------------------------------------------------------------
  doc.font('Times-Bold').fontSize(18).fillColor(INK).text(text(signed.agreement.title));
  doc
    .font('Times-Roman')
    .fontSize(9)
    .fillColor(MUTED)
    .text(
      text(
        `Version ${signed.agreement.version}, published ${formatIst(signed.agreement.publishedAt)} · ${signed.platform.brandName}`,
      ),
    );
  doc.moveDown(0.8);
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + width, doc.y).strokeColor(RULE_COLOUR).lineWidth(1).stroke();
  doc.moveDown(1);

  // --- Parties -------------------------------------------------------------
  const parties: Array<[string, string]> = [
    ['Platform', `${signed.platform.entity}\nGSTIN ${signed.platform.gstin}\n${signed.platform.address}`],
    ['Host', `${signed.host.name}\n${signed.host.email}`],
    [
      'Listing',
      `${signed.property.title}\n${[signed.property.city, signed.property.state].filter(Boolean).join(', ')}\nReference ${signed.property.id}`,
    ],
  ];
  doc.font('Times-Bold').fontSize(11).fillColor(INK).text('Parties and listing');
  doc.moveDown(0.4);
  for (const [label, value] of parties) {
    doc.font('Times-Bold').fontSize(9).fillColor(MUTED).text(text(label.toUpperCase()));
    doc.font('Times-Roman').fontSize(10).fillColor(INK).text(text(value), { lineGap: 1 });
    doc.moveDown(0.5);
  }

  doc.moveDown(0.5);
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + width, doc.y).strokeColor(RULE_COLOUR).stroke();
  doc.moveDown(1);

  // --- Agreement body ------------------------------------------------------
  for (const block of parseAgreementBlocks(signed.agreement.body)) {
    if (block.kind === 'heading') {
      // Keep a heading with at least a little of what follows it.
      if (doc.y > doc.page.height - PAGE_MARGIN - 80) doc.addPage();
      doc.moveDown(0.6);
      doc.font('Times-Bold').fontSize(11).fillColor(INK).text(text(block.text));
      doc.moveDown(0.25);
      continue;
    }
    if (block.kind === 'list') {
      doc.font('Times-Roman').fontSize(10).fillColor(INK);
      for (const item of block.items) {
        doc.text(text(item), { indent: 12, lineGap: 1.5, paragraphGap: 3 });
      }
      continue;
    }
    doc.font('Times-Roman').fontSize(10).fillColor(INK).text(text(block.text), { lineGap: 1.5, paragraphGap: 4 });
  }

  // --- Signature block -----------------------------------------------------
  // Always starts a fresh page: the evidence should never be split across a
  // page break, and it is the first thing anyone opening the file looks for.
  doc.addPage();
  doc.font('Times-Bold').fontSize(14).fillColor(INK).text('Signature');
  doc.moveDown(0.5);
  doc
    .font('Times-Roman')
    .fontSize(10)
    .fillColor(INK)
    .text(
      text(
        `This agreement was signed electronically under the Information Technology Act, 2000. The signatory typed their name to sign; the Platform recorded the details below at the moment of signature.`,
      ),
      { lineGap: 1.5 },
    );
  doc.moveDown(1);

  const facts: Array<[string, string]> = [
    ['Signed by', signed.acceptance.signatureName],
    ['Account', `${signed.host.name} (${signed.host.email})`],
    ['Date and time', `${formatIst(signed.acceptance.acceptedAt)} IST`],
    ['Agreement version', `Version ${signed.agreement.version}`],
    ['Listing', `${signed.property.title} — reference ${signed.property.id}`],
    ['IP address', signed.acceptance.ipAddress || 'Not recorded'],
    ['Device', signed.acceptance.userAgent || 'Not recorded'],
  ];
  for (const [label, value] of facts) {
    const y = doc.y;
    doc.font('Times-Bold').fontSize(9).fillColor(MUTED).text(text(label.toUpperCase()), PAGE_MARGIN, y, { width: 130 });
    doc
      .font('Times-Roman')
      .fontSize(10)
      .fillColor(INK)
      .text(text(value), PAGE_MARGIN + 140, y, { width: width - 140, lineGap: 1 });
    doc.moveDown(0.6);
  }

  doc.moveDown(1);
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + width, doc.y).strokeColor(RULE_COLOUR).stroke();
  doc.moveDown(0.6);
  doc
    .font('Times-Roman')
    .fontSize(8)
    .fillColor(MUTED)
    .text(
      text(
        `Generated by ${signed.platform.brandName} from its records. The signature details above are stored with the signed agreement and are not editable.`,
      ),
      { lineGap: 1 },
    );

  doc.end();
  return done;
}
