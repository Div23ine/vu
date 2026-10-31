import { countWords, readMinutes } from '@vunvault/contracts';

/**
 * Studio markdown helpers .
 *
 * The body editor is a plain `<textarea>` over `bodyMd` (a contentEditable
 * surface is NOT allowed — XSS/IME risk), so two conversions matter:
 *
 * - `htmlToMarkdown` — for PASTE events: rich clipboard HTML is reduced to
 * the small markdown dialect `SafeMarkdown` renders (`##`/`###`, `-` lists,
 * `>` quotes, `**bold**`, `*italic*`, `` `code` ``, http(s) links). Script
 * and style contents are dropped, every other tag unwraps to its text, and
 * non-http(s) hrefs lose their target — nothing executable survives.
 * - `markdownToBlocks` — the block outline used by the subheading list (and
 * the round-trip unit test).
 *
 * `countWords` / `readMinutes` are the contract's own counters, re-exported
 * so the editor imports one module.
 */

export { countWords, readMinutes };

export type MarkdownBlock =
  | { kind: 'heading'; level: 2 | 3; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'quote'; lines: string[] }
  | { kind: 'paragraph'; lines: string[] };

/** Parse the SafeMarkdown dialect into blocks (headings, lists, quotes, paragraphs). */
export function markdownToBlocks(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let quote: string[] = [];

  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', lines: paragraph });
      paragraph = [];
    }
  };
  const flushList = (): void => {
    if (list.length > 0) {
      blocks.push({ kind: 'list', items: list });
      list = [];
    }
  };
  const flushQuote = (): void => {
    if (quote.length > 0) {
      blocks.push({ kind: 'quote', lines: quote });
      quote = [];
    }
  };
  const flushAll = (): void => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    if (line === '') {
      flushAll();
      continue;
    }
    const h3 = /^###\s+(.+)$/.exec(line);
    if (h3?.[1] !== undefined) {
      flushParagraph();
      flushList();
      flushQuote();
      blocks.push({ kind: 'heading', level: 3, text: h3[1] });
      continue;
    }
    const h2 = /^##\s+(.+)$/.exec(line);
    if (h2?.[1] !== undefined) {
      flushParagraph();
      flushList();
      flushQuote();
      blocks.push({ kind: 'heading', level: 2, text: h2[1] });
      continue;
    }
    const item = /^-\s+(.+)$/.exec(line);
    if (item?.[1] !== undefined) {
      flushParagraph();
      flushQuote();
      list.push(item[1]);
      continue;
    }
    const quoted = /^>\s?(.*)$/.exec(line);
    if (quoted !== null) {
      flushParagraph();
      flushList();
      quote.push(quoted[1] ?? '');
      continue;
    }
    flushList();
    flushQuote();
    paragraph.push(line);
  }
  flushAll();
  return blocks;
}

/** Tags whose CONTENTS must never reach the markdown (not even as text). */
const DROPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED']);

function serializeChildren(nodes: NodeListOf<ChildNode>): string {
  let out = '';
  for (const node of Array.from(nodes)) out += serializeNode(node);
  return out;
}

function serializeNode(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const element = node as HTMLElement;
  if (DROPPED_TAGS.has(element.tagName)) return '';
  const inner = serializeChildren(element.childNodes);

  switch (element.tagName) {
    case 'B':
    case 'STRONG':
      return `**${inner.trim()}**`;
    case 'I':
    case 'EM':
      return `*${inner.trim()}*`;
    case 'CODE':
      return `\`${inner.trim()}\``;
    case 'A': {
      const href = element.getAttribute('href') ?? '';
      const label = inner.trim();
      return /^https?:\/\//i.test(href) ? `[${label}](${href})` : label;
    }
    case 'BR':
      return '\n';
    case 'H1':
    case 'H2':
      return `\n\n## ${inner.trim()}\n\n`;
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6':
      return `\n\n### ${inner.trim()}\n\n`;
    case 'P':
    case 'DIV':
    case 'SECTION':
    case 'ARTICLE':
      return `\n\n${inner.trim()}\n\n`;
    case 'UL':
    case 'OL': {
      const items = Array.from(element.children)
        .filter((child) => child.tagName === 'LI')
        .map((child) => `- ${serializeChildren(child.childNodes).trim()}`)
        .join('\n');
      return `\n\n${items}\n\n`;
    }
    case 'LI':
      return `\n- ${inner.trim()}`;
    case 'BLOCKQUOTE': {
      const lines = inner
        .trim()
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
      return `\n\n${lines}\n\n`;
    }
    default:
      return inner;
  }
}

/**
 * Convert pasted HTML into the SafeMarkdown dialect. The output is PLAIN
 * TEXT plus markdown markers — it is stored as `bodyMd` and re-rendered
 * structurally by `SafeMarkdown`, never as HTML.
 */
export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return serializeChildren(doc.body.childNodes)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
