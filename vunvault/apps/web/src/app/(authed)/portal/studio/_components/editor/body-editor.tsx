'use client';

import { useRef } from 'react';
import { STUDIO_LIMITS } from '@vunvault/contracts';
import { htmlToMarkdown } from '../../_lib/markdown';
import { SubheadingList } from './subheading-list';
import { Toolbar } from './toolbar';
import '../../_styles/editor.css';

/**
 * Main-body editor (Task 72) — a plain `<textarea>` over `bodyMd` with the
 * markdown toolbar, the live Words / Characters / Read-time stats and the
 * `Target met` indicator at `STUDIO_LIMITS.minWords`. Pasting rich HTML runs
 * it through `htmlToMarkdown` first, so only the markdown dialect is ever
 * stored (the API sanitises again; `SafeMarkdown` renders structurally).
 */

interface BodyEditorProps {
  bodyMd: string;
  words: number;
  readTime: number;
  disabled?: boolean;
  onBodyChange(value: string): void;
}

export function BodyEditor({
  bodyMd,
  words,
  readTime,
  disabled = false,
  onBodyChange,
}: BodyEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const targetMet = words >= STUDIO_LIMITS.minWords;

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    const html = event.clipboardData.getData('text/html');
    if (html === '') return;
    event.preventDefault();
    const markdown = htmlToMarkdown(html);
    const el = event.currentTarget;
    const { selectionStart: start, selectionEnd: end } = el;
    onBodyChange(bodyMd.slice(0, start) + markdown + bodyMd.slice(end));
  };

  return (
    <div className="vbg-field">
      <label className="vbg-label" htmlFor="post-body">
        <span>
          Main Body
          <span className="vbg-label-req" aria-hidden="true">
            *
          </span>
        </span>
        <span className="vbg-label-hint">Markdown-style formatting supported</span>
      </label>

      <Toolbar
        textareaRef={textareaRef}
        value={bodyMd}
        disabled={disabled}
        onChange={onBodyChange}
      />

      <textarea
        id="post-body"
        ref={textareaRef}
        className="vbg-textarea vbg-body"
        rows={14}
        value={bodyMd}
        disabled={disabled}
        onChange={(event) => onBodyChange(event.target.value)}
        onPaste={handlePaste}
      />

      <div className="vbg-stats">
        <span className="vbg-stat">
          Words <strong>{words}</strong>
        </span>
        <span className="vbg-stat">
          Characters <strong>{bodyMd.length}</strong>
        </span>
        <span className="vbg-stat">
          Read time <strong>{readTime} min</strong>
        </span>
        {targetMet ? (
          <span className="vbg-stat vbg-stat--met">
            Target <strong>met</strong>
          </span>
        ) : (
          <span className="vbg-stat">
            Target ≥ <strong>{STUDIO_LIMITS.minWords}</strong> words
          </span>
        )}
      </div>

      <SubheadingList bodyMd={bodyMd} />

      <p className="vbg-body-note">
        The moderation team reads the raw text and the rendered preview. Keep claims sourced.
      </p>
    </div>
  );
}
