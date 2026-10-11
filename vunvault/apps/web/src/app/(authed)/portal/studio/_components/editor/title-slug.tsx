'use client';

import { Lock, Unlock } from 'lucide-react';
import { STUDIO_LIMITS } from '@vunvault/contracts';
import '../../_styles/editor.css';

/**
 * Title + URL slug fields (Task 72). The slug auto-follows the title until
 * the author locks it (or edits it by hand, which locks it); the lock toggle
 * carries the prototype's verbatim state strings as its accessible name.
 */

interface TitleSlugProps {
  title: string;
  slug: string;
  slugLocked: boolean;
  disabled?: boolean;
  onTitleChange(value: string): void;
  onSlugChange(value: string): void;
  onToggleSlugLock(): void;
}

export function TitleSlug({
  title,
  slug,
  slugLocked,
  disabled = false,
  onTitleChange,
  onSlugChange,
  onToggleSlugLock,
}: TitleSlugProps) {
  const lockLabel = slugLocked
    ? 'Slug locked — click to resume auto-updates'
    : 'Lock slug to stop auto-updates';

  return (
    <>
      <div className="vbg-field">
        <label className="vbg-label" htmlFor="post-title">
          <span>
            Post Title
            <span className="vbg-label-req" aria-hidden="true">
              *
            </span>
          </span>
          <span className="vbg-label-hint" id="titleCount">
            {title.length} / {STUDIO_LIMITS.title}
          </span>
        </label>
        <input
          id="post-title"
          className="vbg-input vbg-input--title"
          type="text"
          maxLength={STUDIO_LIMITS.title}
          placeholder="Give your story a headline…"
          autoComplete="off"
          value={title}
          disabled={disabled}
          onChange={(event) => onTitleChange(event.target.value)}
        />
      </div>

      <div className="vbg-field">
        <label className="vbg-label" htmlFor="post-slug">
          <span>URL Slug</span>
          <span className="vbg-label-hint">Auto-generated from the title</span>
        </label>
        <div className="vbg-slug-wrap">
          <span className="vbg-slug-prefix" aria-hidden="true">
            /blog/
          </span>
          <input
            id="post-slug"
            className="vbg-input"
            type="text"
            value={slug}
            disabled={disabled}
            onChange={(event) => onSlugChange(event.target.value)}
          />
          <button
            type="button"
            className="vbg-slug-lock"
            title={lockLabel}
            aria-label={lockLabel}
            aria-pressed={slugLocked}
            disabled={disabled}
            onClick={onToggleSlugLock}
          >
            {slugLocked ? (
              <Lock size={14} aria-hidden="true" />
            ) : (
              <Unlock size={14} aria-hidden="true" />
            )}
          </button>
        </div>
        <p className="vbg-slug-help">Public URL: /blog/{slug === '' ? '…' : slug}</p>
      </div>
    </>
  );
}
