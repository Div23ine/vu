import { describe, expect, it } from 'vitest';
import { assertNever } from './assert';
import { cn } from './cn';

describe('cn', () => {
  it('joins conditional class values', () => {
    const includeB = false;
    expect(cn('a', includeB && 'b', undefined, 'c')).toBe('a c');
    expect(cn({ a: true, b: false })).toBe('a');
    expect(cn(['a', ['b']])).toBe('a b');
  });

  it('lets the last conflicting Tailwind utility win', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
    expect(cn('text-ink-muted', 'text-brand-strong')).toBe('text-brand-strong');
  });
});

describe('assertNever', () => {
  it('throws for a value that should have been impossible', () => {
    expect(() => assertNever('unexpected' as never)).toThrow('Unhandled value: unexpected');
  });

  it('makes an exhaustive switch compile', () => {
    type Kind = 'a' | 'b';
    const label = (kind: Kind): string => {
      switch (kind) {
        case 'a':
          return 'first';
        case 'b':
          return 'second';
        default:
          return assertNever(kind);
      }
    };
    expect(label('a')).toBe('first');
    expect(label('b')).toBe('second');
  });
});
