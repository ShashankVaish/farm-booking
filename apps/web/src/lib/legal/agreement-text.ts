/**
 * The host agreement is plain text written by an admin in a textarea, with
 * three lightweight conventions so it can still have some shape:
 *
 *   "## Heading"   a section heading
 *   "- item"       a bullet
 *   blank line     paragraph break
 *
 * This turns that text into blocks the page can render. Nothing is treated as
 * HTML, so an admin cannot accidentally (or otherwise) inject markup into a
 * document every host is asked to sign.
 */
export type AgreementBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] };

export function parseAgreementText(body: string): AgreementBlock[] {
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
