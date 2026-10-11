'use client';

import { useState } from 'react';
import { Hash, X } from 'lucide-react';
import { STUDIO_TAG_SUGGESTIONS } from '@vunvault/contracts';
import '../../_styles/editor.css';

/**
 * Tag input (Task 72) — chips with Enter/comma to add and Backspace-on-empty
 * to remove the last one, the `STUDIO_TAG_SUGGESTIONS` quick-adds and the
 * verbatim limit note. Limit and duplicate enforcement (with the prototype's
 * verbatim toasts) lives in the hook; this is the input surface.
 */

interface TagInputProps {
  tags: string[];
  disabled?: boolean;
  onAdd(raw: string): void;
  onRemove(tag: string): void;
  onRemoveLast(): void;
}

export function TagInput({ tags, disabled = false, onAdd, onRemove, onRemoveLast }: TagInputProps) {
  const [draft, setDraft] = useState('');

  const commit = (): void => {
    if (draft.trim() === '') return;
    onAdd(draft);
    setDraft('');
  };

  return (
    <section className="vbg-card" aria-labelledby="vbgTagsHeading">
      <div className="vbg-card-head">
        <div>
          <h2 className="vbg-card-title" id="vbgTagsHeading">
            <Hash size={16} aria-hidden="true" />
            Hashtags / Tags
          </h2>
          <p className="vbg-card-note">
            Press <kbd className="vbg-kbd">Enter</kbd> or <kbd className="vbg-kbd">comma</kbd> to
            add a tag. Backspace removes the last one.
          </p>
        </div>
        <span className="vbg-pill vbg-pill--info">{tags.length} tags</span>
      </div>
      <div className="vbg-card-body">
        {tags.length > 0 ? (
          <ul className="vbg-tag-list" aria-label="Attached tags">
            {tags.map((tag) => (
              <li key={tag} className="vbg-tag">
                <span>#{tag}</span>
                <button
                  type="button"
                  aria-label={`Remove tag ${tag}`}
                  disabled={disabled}
                  onClick={() => onRemove(tag)}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <input
          className="vbg-input"
          type="text"
          aria-label="Add a tag"
          placeholder="Add a tag…"
          autoComplete="off"
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              commit();
              return;
            }
            if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
              event.preventDefault();
              onRemoveLast();
            }
          }}
        />

        <div className="vbg-field vbg-suggest-field">
          <span className="vbg-label-hint">Suggestions</span>
          <div className="vbg-suggest">
            {STUDIO_TAG_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="vbg-suggest-chip"
                disabled={disabled}
                onClick={() => onAdd(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        <p className="vbg-card-note vbg-tags-foot">
          Maximum 8 tags. Tags drive related-article feeds and topic pages.
        </p>
      </div>
    </section>
  );
}
