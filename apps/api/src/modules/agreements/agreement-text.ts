/**
 * Parses the plain text an admin writes into blocks.
 *
 * Conventions, kept deliberately small so the admin textarea stays a textarea:
 *   "## Heading"   a section heading
 *   "- item"       a bullet
 *   blank line     paragraph break
 *
 * This mirrors `apps/web/src/lib/legal/agreement-text.ts`. The two are
 * duplicated rather than shared because the repo has no shared package, and a
 * forty-line pure function is a smaller cost than introducing one. They must
 * agree: the web copy renders what the host reads on screen, this copy renders
 * the PDF of what they signed, and a reader comparing the two should find the
 * same document. Change both together.
 */
export type AgreementBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] };

export function parseAgreementBlocks(body: string): AgreementBlock[] {
  const blocks: AgreementBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push({ kind: 'list', items: list });
      list = [];
    }
  };

  for (const raw of body.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    if (line.startsWith('## ')) {
      flushParagraph();
      flushList();
      blocks.push({ kind: 'heading', text: line.slice(3).trim() });
      continue;
    }
    if (/^[-*•]\s+/.test(line)) {
      flushParagraph();
      list.push(line.replace(/^[-*•]\s+/, ''));
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}
