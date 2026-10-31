import { describe, expect, it } from 'vitest';
import { countWords, htmlToMarkdown, markdownToBlocks, readMinutes } from './markdown';

/**
 * Markdown helper tests — the spec's round-trip: pasted HTML
 * converts to the SafeMarkdown dialect, the dialect parses back into the
 * block outline, and the contract counters are re-exported intact.
 */

const SAMPLE_HTML = [
  '<h2>East Africa’s cyber week</h2>',
  '<p>Regulators met in <strong>Nairobi</strong> to discuss <em>cross-border</em> incident response.</p>',
  '<ul><li>Kenya adopted the new code</li><li>Tanzania piloted the registry</li></ul>',
  '<blockquote>Trust, but verify.</blockquote>',
].join('');

const SAMPLE_MD = [
  '## East Africa’s cyber week',
  '',
  'Regulators met in **Nairobi** to discuss *cross-border* incident response.',
  '',
  '- Kenya adopted the new code',
  '- Tanzania piloted the registry',
  '',
  '> Trust, but verify.',
].join('\n');

describe('htmlToMarkdown', () => {
  it('round-trips the sample into the SafeMarkdown dialect', () => {
    expect(htmlToMarkdown(SAMPLE_HTML)).toBe(SAMPLE_MD);
  });

  it('keeps http(s) links and drops everything else', () => {
    const md = htmlToMarkdown(
      '<p>See <a href="https://vunvault.example/report">the report</a> and <a href="javascript:alert(1)">this</a>.</p>',
    );
    expect(md).toBe('See [the report](https://vunvault.example/report) and this.');
  });

  it('drops script and style contents entirely', () => {
    const md = htmlToMarkdown('<script>alert("pwn")</script><style>*{}</style><p>Safe</p>');
    expect(md).toBe('Safe');
    expect(md).not.toContain('alert');
  });

  it('maps inline code and headings', () => {
    expect(htmlToMarkdown('<h3>Fix</h3><p>Run <code>vv scan</code> now</p>')).toBe(
      '### Fix\n\nRun `vv scan` now',
    );
  });
});

describe('markdownToBlocks', () => {
  it('parses the round-tripped sample into its outline', () => {
    expect(markdownToBlocks(SAMPLE_MD)).toEqual([
      { kind: 'heading', level: 2, text: 'East Africa’s cyber week' },
      {
        kind: 'paragraph',
        lines: ['Regulators met in **Nairobi** to discuss *cross-border* incident response.'],
      },
      { kind: 'list', items: ['Kenya adopted the new code', 'Tanzania piloted the registry'] },
      { kind: 'quote', lines: ['Trust, but verify.'] },
    ]);
  });

  it('keeps h2 and h3 apart and ends open blocks at the source end', () => {
    expect(markdownToBlocks('## Two\n### Three\n- one')).toEqual([
      { kind: 'heading', level: 2, text: 'Two' },
      { kind: 'heading', level: 3, text: 'Three' },
      { kind: 'list', items: ['one'] },
    ]);
  });

  it('returns no blocks for an empty body', () => {
    expect(markdownToBlocks('')).toEqual([]);
  });
});

describe('contract re-exports', () => {
  it('re-exports countWords and readMinutes intact', () => {
    // The contract counter strips `#>*~|` but counts the bare `-` list markers.
    expect(countWords(SAMPLE_MD)).toBe(27);
    expect(readMinutes(SAMPLE_MD)).toBe(1);
    expect(countWords('')).toBe(0);
  });
});
