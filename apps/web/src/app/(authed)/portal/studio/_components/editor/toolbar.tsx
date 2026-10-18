'use client';

import type { RefObject } from 'react';
import { Bold, Code, Eraser, Heading2, Heading3, Italic, Link2, List, Quote } from 'lucide-react';
import { toast } from '@vunvault/ui';
import '../../_styles/editor.css';

/**
 * Markdown toolbar — every button acts on the textarea's current
 * selection: inline wraps (bold/italic/code/link) and line prefixes
 * (H2/H3/list/quote). `Clear formatting` on an empty selection toasts the
 * design's verbatim pair. The editor value IS `bodyMd` — no
 * contentEditable anywhere (XSS/IME risk, banned by the spec).
 */

interface ToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  disabled?: boolean;
  onChange(value: string): void;
}

export function Toolbar({ textareaRef, value, disabled = false, onChange }: ToolbarProps) {
  function replaceRange(start: number, end: number, replacement: string): void {
    onChange(value.slice(0, start) + replacement + value.slice(end));
    const el = textareaRef.current;
    if (el === null) return;
    // Restore the selection around the inserted markup after React commits.
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start, start + replacement.length);
    }, 0);
  }

  function wrapSelection(before: string, after: string, placeholder: string): void {
    const el = textareaRef.current;
    if (el === null) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const selection = value.slice(start, end);
    const body = selection === '' ? placeholder : selection;
    replaceRange(start, end, `${before}${body}${after}`);
  }

  function prefixLines(prefix: string): void {
    const el = textareaRef.current;
    if (el === null) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const lineStart = value.lastIndexOf('\n', Math.max(start - 1, 0)) + 1;
    const nextBreak = value.indexOf('\n', end);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    const block = value.slice(lineStart, lineEnd);
    const transformed = block
      .split('\n')
      .map((line) => (line.startsWith(prefix) ? line : `${prefix}${line}`))
      .join('\n');
    replaceRange(lineStart, lineEnd, transformed);
  }

  function clearFormatting(): void {
    const el = textareaRef.current;
    if (el === null) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const selection = value.slice(start, end);
    if (selection === '') {
      toast({
        kind: 'warn',
        title: 'Nothing selected',
        message: 'Highlight some text first, then clear its formatting.',
      });
      return;
    }
    const cleaned = selection.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*`>#]/g, '');
    replaceRange(start, end, cleaned);
  }

  return (
    <div
      className="vbg-toolbar"
      role="toolbar"
      aria-label="Body formatting"
      aria-controls="post-body"
    >
      <button
        type="button"
        className="vbg-tool vbg-tool--b"
        aria-label="Bold"
        title="Bold"
        disabled={disabled}
        onClick={() => wrapSelection('**', '**', 'bold text')}
      >
        <Bold size={14} aria-hidden="true" />
        <span>B</span>
      </button>
      <button
        type="button"
        className="vbg-tool vbg-tool--i"
        aria-label="Italic"
        title="Italic"
        disabled={disabled}
        onClick={() => wrapSelection('*', '*', 'italic text')}
      >
        <Italic size={14} aria-hidden="true" />
        <span>I</span>
      </button>
      <button
        type="button"
        className="vbg-tool"
        aria-label="Heading 2"
        title="Heading 2"
        disabled={disabled}
        onClick={() => prefixLines('## ')}
      >
        <Heading2 size={14} aria-hidden="true" />
        <span>H2</span>
      </button>
      <button
        type="button"
        className="vbg-tool"
        aria-label="Heading 3"
        title="Heading 3"
        disabled={disabled}
        onClick={() => prefixLines('### ')}
      >
        <Heading3 size={14} aria-hidden="true" />
        <span>H3</span>
      </button>
      <button
        type="button"
        className="vbg-tool"
        aria-label="Bulleted list"
        title="Bulleted list"
        disabled={disabled}
        onClick={() => prefixLines('- ')}
      >
        <List size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="vbg-tool"
        aria-label="Block quote"
        title="Block quote"
        disabled={disabled}
        onClick={() => prefixLines('> ')}
      >
        <Quote size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="vbg-tool"
        aria-label="Insert link"
        title="Insert link"
        disabled={disabled}
        onClick={() => wrapSelection('[', '](https://)', 'link text')}
      >
        <Link2 size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="vbg-tool"
        aria-label="Inline code"
        title="Inline code"
        disabled={disabled}
        onClick={() => wrapSelection('`', '`', 'code')}
      >
        <Code size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="vbg-tool vbg-tool--clear"
        aria-label="Clear formatting"
        title="Clear formatting"
        disabled={disabled}
        onClick={clearFormatting}
      >
        <Eraser size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
