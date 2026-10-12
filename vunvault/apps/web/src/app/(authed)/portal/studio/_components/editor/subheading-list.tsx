import { markdownToBlocks, type MarkdownBlock } from '../../_lib/markdown';
import '../../_styles/editor.css';

/**
 * Subheading list (Task 72) — the live outline of the body's `##`/`###`
 * headings, parsed by `markdownToBlocks`. Hidden while the body has no
 * headings. Presentational; rendered inside the Article Content card.
 */

type HeadingBlock = Extract<MarkdownBlock, { kind: 'heading' }>;

export function SubheadingList({ bodyMd }: { bodyMd: string }) {
  const headings = markdownToBlocks(bodyMd).filter(
    (block): block is HeadingBlock => block.kind === 'heading',
  );
  if (headings.length === 0) return null;

  return (
    <div className="vbg-outline">
      <span className="vbg-label-hint">Subheadings</span>
      <ol className="vbg-outline-list">
        {headings.map((heading, index) => (
          <li key={`${heading.level}-${index}-${heading.text}`}>
            <span className="vbg-outline-level" aria-hidden="true">
              H{heading.level}
            </span>
            <span>{heading.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
