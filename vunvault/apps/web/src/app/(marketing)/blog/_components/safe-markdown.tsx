import { Fragment, type ReactNode } from 'react';

/**
 * SafeMarkdown (Task 56) — the tiny, closed markdown renderer for article
 * bodies.
 *
 * Supported blocks: `##` / `###` headings, paragraphs, `-` bullet lists and
 * `>` quotes. Supported inline: `**bold**`, `*italic*`, `` `code` `` and
 * `[text](https://…)` links (http/https ONLY; every link gets
 * `rel="noopener noreferrer nofollow"`).
 *
 * What it is NOT: an HTML parser. The source is treated as plain text and
 * emitted as React elements, so raw markup (`<script>`, `<img onerror=…`)
 * renders inert — React escapes it — and non-http(s) link targets
 * (`javascript:`, `data:`) drop their href and render as text. There is no
 * `dangerouslySetInnerHTML` anywhere in this file, and images are not
 * rendered at all. The API stores `body_md` sanitised (Task 36); this is the
 * second, structural layer.
 */

type Block =
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'quote'; lines: string[] }
  | { kind: 'list'; items: string[] }
  | { kind: 'paragraph'; lines: string[] };

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let quote: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', lines: paragraph });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length > 0) {
      blocks.push({ kind: 'list', items: list });
      list = [];
    }
  };
  const flushQuote = () => {
    if (quote.length > 0) {
      blocks.push({ kind: 'quote', lines: quote });
      quote = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const rawLine of source.split('\n')) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed === '') {
      flushAll();
      continue;
    }
    if (trimmed.startsWith('### ')) {
      flushAll();
      blocks.push({ kind: 'h3', text: trimmed.slice(4) });
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushAll();
      blocks.push({ kind: 'h2', text: trimmed.slice(3) });
      continue;
    }
    if (trimmed.startsWith('- ')) {
      flushParagraph();
      flushQuote();
      list.push(trimmed.slice(2));
      continue;
    }
    if (trimmed.startsWith('> ')) {
      flushParagraph();
      flushList();
      quote.push(trimmed.slice(2));
      continue;
    }
    flushList();
    flushQuote();
    paragraph.push(line);
  }
  flushAll();
  return blocks;
}

const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
const LINK_PATTERN = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

function isSafeUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://');
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let index = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const start = match.index;
    const token = match[0];
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));

    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(<strong key={`${keyPrefix}-${index}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(<code key={`${keyPrefix}-${index}`}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(<em key={`${keyPrefix}-${index}`}>{token.slice(1, -1)}</em>);
    } else {
      const link = LINK_PATTERN.exec(token);
      const label = link?.[1] ?? token;
      const url = link?.[2] ?? '';
      if (link !== null && isSafeUrl(url)) {
        nodes.push(
          <a
            key={`${keyPrefix}-${index}`}
            href={url}
            rel="noopener noreferrer nofollow"
            target="_blank"
          >
            {label}
          </a>,
        );
      } else {
        // Unsafe or malformed target: render the label as inert text.
        nodes.push(<Fragment key={`${keyPrefix}-${index}`}>{label}</Fragment>);
      }
    }

    lastIndex = start + token.length;
    index += 1;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export interface SafeMarkdownProps {
  source: string;
}

export function SafeMarkdown({ source }: SafeMarkdownProps) {
  const blocks = parseBlocks(source);

  return (
    <>
      {blocks.map((block, blockIndex) => {
        const key = `block-${blockIndex}`;
        switch (block.kind) {
          case 'h2':
            return <h2 key={key}>{renderInline(block.text, key)}</h2>;
          case 'h3':
            return <h3 key={key}>{renderInline(block.text, key)}</h3>;
          case 'quote':
            return (
              <blockquote key={key}>
                {block.lines.map((line, lineIndex) => (
                  <p key={`${key}-${lineIndex}`}>{renderInline(line, `${key}-${lineIndex}`)}</p>
                ))}
              </blockquote>
            );
          case 'list':
            return (
              <ul key={key}>
                {block.items.map((item, itemIndex) => (
                  <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
                ))}
              </ul>
            );
          case 'paragraph':
            return (
              <p key={key}>
                {block.lines.map((line, lineIndex) => (
                  <Fragment key={`${key}-${lineIndex}`}>
                    {lineIndex > 0 ? ' ' : null}
                    {renderInline(line, `${key}-${lineIndex}`)}
                  </Fragment>
                ))}
              </p>
            );
        }
      })}
    </>
  );
}
