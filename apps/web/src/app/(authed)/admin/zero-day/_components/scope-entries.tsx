'use client';

import { useId, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { AdvisoryScopeEntry, ScopeCategory } from '@vunvault/contracts';
import { SCOPE_CATEGORY_LABELS, ScopeCategorySchema } from '@vunvault/contracts';
import { cn } from '@vunvault/lib';
import { toast } from '@vunvault/ui';

/**
 * Affected-scope editor (Task 81) — the chip list the broadcast engine matches
 * against client asset inventories.
 *
 * Type + Enter (or `Add`) appends an entry carrying the currently selected
 * category; duplicates are refused with the prototype's own toast, and the
 * contract's 50-entry cap is enforced here so the API never has to. Every
 * remove button is labelled with its entry (`Remove scope entry: <entry>`)
 * because seven near-identical X buttons are otherwise indistinguishable to a
 * screen reader.
 *
 * `Quick add:` is the prototype's shortcut row — one button per
 * `SCOPE_CATEGORY_LABELS` value that appends that category immediately, going
 * through the same duplicate and cap rules as a typed entry.
 */

/** The contract's cap (`AdvisoryDraftBody.scope.max(50)`), mirrored for the UI. */
export const SCOPE_ENTRY_LIMIT = 50;

const CATEGORY_OPTIONS = ScopeCategorySchema.options;

export interface ScopeEntriesProps {
  entries: readonly AdvisoryScopeEntry[];
  onChange(entries: AdvisoryScopeEntry[]): void;
  invalid?: boolean;
}

export function ScopeEntries({ entries, onChange, invalid = false }: ScopeEntriesProps) {
  const inputId = useId();
  const selectId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState('');
  const [category, setCategory] = useState<ScopeCategory | ''>('');

  const add = (label: string, nextCategory: ScopeCategory | null): void => {
    const trimmed = label.trim();
    if (trimmed === '') return;
    if (entries.some((entry) => entry.label.toLowerCase() === trimmed.toLowerCase())) {
      toast({
        kind: 'warn',
        title: 'Already in scope',
        message: `"${trimmed}" is already listed.`,
      });
      return;
    }
    if (entries.length >= SCOPE_ENTRY_LIMIT) {
      toast({
        kind: 'warn',
        title: 'Scope limit reached',
        message: `An advisory can list at most ${SCOPE_ENTRY_LIMIT} scope entries.`,
      });
      return;
    }
    onChange([...entries, { label: trimmed, category: nextCategory }]);
  };

  const onAddClick = (): void => {
    add(draft, category === '' ? null : category);
    setDraft('');
    inputRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') return;
    // The field sits inside the editor's <form>: Enter must add a chip, never
    // submit the advisory.
    event.preventDefault();
    onAddClick();
  };

  const remove = (index: number): void => {
    onChange(entries.filter((_entry, position) => position !== index));
  };

  return (
    <div className="zd-field">
      <div className="zd-label-row">
        <label className="zd-label" htmlFor={inputId}>
          <span>Affected Products, Versions, Platforms or Hosts</span>
        </label>
        <span className="zd-hint">Press Enter to add</span>
      </div>

      <div className="zd-scope-input-row">
        <input
          ref={inputRef}
          id={inputId}
          className={cn('zd-input', invalid ? 'is-invalid' : undefined)}
          type="text"
          value={draft}
          autoComplete="off"
          aria-invalid={invalid || undefined}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <select
          id={selectId}
          className="zd-select"
          aria-label="Scope category"
          value={category}
          onChange={(event) => setCategory(event.target.value as ScopeCategory | '')}
        >
          <option value="" />
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {SCOPE_CATEGORY_LABELS[option]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="adm-btn adm-btn-primary zd-scope-add"
          onClick={onAddClick}
          disabled={draft.trim() === ''}
        >
          <Plus size={15} aria-hidden="true" />
          <span>Add</span>
        </button>
      </div>

      <div className="zd-quick-add">
        <span className="zd-quick-add-label">Quick add:</span>
        {CATEGORY_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => add(SCOPE_CATEGORY_LABELS[option], option)}
          >
            {SCOPE_CATEGORY_LABELS[option]}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="zd-scope-empty">No scope entries</p>
      ) : (
        <ul className="zd-scope-chips">
          {entries.map((entry, index) => (
            <li key={`${entry.label}:${entry.category ?? 'none'}`} className="zd-scope-chip">
              {entry.category === null ? null : (
                <span className="zd-scope-chip-cat">{SCOPE_CATEGORY_LABELS[entry.category]}</span>
              )}
              {entry.label}
              <button
                type="button"
                className="zd-scope-remove"
                aria-label={`Remove scope entry: ${entry.label}`}
                onClick={() => remove(index)}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="zd-note">
        Add every product, version range, platform or client host class the advisory applies to. The
        broadcast engine matches these against client asset inventories.
      </p>
    </div>
  );
}
