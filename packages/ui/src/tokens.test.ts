import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { tokens } from './tokens.js';

const stylesDir = join(dirname(fileURLToPath(import.meta.url)), 'styles');
const read = (file: string): string => readFileSync(join(stylesDir, file), 'utf8');

/** CSS is whitespace-insensitive; compare with all whitespace removed. */
const squash = (css: string): string => css.replace(/\s+/g, '').toLowerCase();

const tokensCss = read('tokens.css');
const themeCss = read('theme.css');
const baseCss = read('base.css');
const motionCss = read('motion.css');
const indexCss = read('index.css');

describe('tokens.css', () => {
  it('declares every colour mirrored by tokens.ts', () => {
    const css = squash(tokensCss);
    for (const [name, value] of Object.entries(tokens.color)) {
      expect(css, `missing colour ${name}`).toContain(value.toLowerCase());
    }
  });

  it('declares every radius mirrored by tokens.ts', () => {
    const css = squash(tokensCss);
    for (const [name, value] of Object.entries(tokens.radius)) {
      expect(css, `missing radius ${name}`).toContain(`--r-${name}:${value}px`);
    }
  });

  it('declares the motion tokens mirrored by tokens.ts', () => {
    const css = squash(tokensCss);
    expect(css).toContain(`--ease:${squash(tokens.motion.ease)}`);
    expect(css).toContain(`--ease-out:${squash(tokens.motion.easeOut)}`);
    expect(css).toContain(`--dur:${tokens.motion.durMs}ms`);
  });

  it('holds every semantic token the components consume', () => {
    const css = squash(tokensCss);
    for (const name of [
      '--dark-deep',
      '--dark-abyss',
      '--brand-bright',
      '--ok-ink',
      '--ok-bg',
      '--ok-line',
      '--warn-ink',
      '--warn-bg',
      '--warn-line',
      '--danger-ink',
      '--danger-bg',
      '--danger-line',
      '--pill-ok-ink',
      '--table-head',
      '--slate-text',
      '--slate-muted',
      '--r-field',
      '--r-toast',
      '--r-kpi',
      '--r-tile',
      '--sh-card',
      '--sh-kpi',
      '--sh-btn-brand',
      '--sh-ghost',
      '--sh-toast',
      '--sh-tile',
      '--grad-brand',
      '--grad-dark',
      '--grad-tile',
    ]) {
      expect(css, `missing token ${name}`).toContain(`${name}:`);
    }
  });

  it('does not declare the font stacks (those live in theme.css)', () => {
    expect(squash(tokensCss)).not.toContain('--font-sans:');
    expect(squash(tokensCss)).not.toContain('--font-mono:');
    expect(squash(themeCss)).toContain('--font-sans:');
    expect(squash(themeCss)).toContain('--font-mono:');
  });
});

describe('theme.css', () => {
  it('maps every colour token to a Tailwind colour utility', () => {
    const css = squash(themeCss);
    for (const name of ['brand', 'ink-muted', 'critical', 'ok', 'pill-ok-ink', 'slate-muted']) {
      expect(css, `missing --color-${name}`).toContain(`--color-${name}:var(--${name})`);
    }
  });

  it('maps radii, easing and shadows', () => {
    const css = squash(themeCss);
    expect(css).toContain('--radius-2xl:var(--r-2xl)');
    expect(css).toContain('--radius-field:var(--r-field)');
    expect(css).toContain('--ease-vv:var(--ease)');
    expect(css).toContain('--shadow-card:var(--sh-card)');
    expect(css).toContain('--default-transition-duration:var(--dur)');
  });

  it('declares the gradient utilities', () => {
    expect(themeCss).toContain('@utility bg-grad-brand');
    expect(themeCss).toContain('@utility bg-grad-dark');
    expect(themeCss).toContain('@utility bg-grad-tile');
  });

  it('declares an animation token for every keyframe it references', () => {
    const css = squash(themeCss);
    const keyframes = new Set(
      [...motionCss.matchAll(/@keyframes\s+([\w-]+)/g)].map((match) => match[1] as string),
    );
    for (const animation of [
      'vv-spin',
      'vv-ping',
      'vv-pulse',
      'vv-bounce',
      'vv-fade-in',
      'vv-float',
      'vv-marquee',
      'vv-fade-up',
      'vv-modal-pop',
      'vv-toast-in',
      'vv-toast-out',
    ]) {
      expect(css, `missing --animate-${animation}`).toContain(`--animate-${animation}:`);
      expect(keyframes.has(animation), `missing @keyframes ${animation}`).toBe(true);
    }
  });
});

describe('base.css', () => {
  it('paints the document with tokens only', () => {
    const css = squash(baseCss);
    expect(css).toContain('background-color:var(--paper)');
    expect(css).toContain('color:var(--ink)');
    expect(css).toContain('body.nav-open{overflow:hidden;}');
    expect(css).toContain(':focus-visible{outline:2pxsolidvar(--brand);outline-offset:2px;}');
  });
});

describe('motion.css', () => {
  it('ships a reduced-motion fallback that disables animation and transition', () => {
    const css = squash(motionCss);
    expect(css).toContain('@media(prefers-reduced-motion:reduce)');
    expect(css).toContain('animation-duration:0.01ms!important');
    expect(css).toContain('animation-iteration-count:1!important');
    expect(css).toContain('transition-duration:0.01ms!important');
    expect(css).toContain('scroll-behavior:auto!important');
  });
});

describe('index.css', () => {
  it('imports the stylesheets in the documented order', () => {
    const order = [...indexCss.matchAll(/@import\s+['"]([^'"]+)['"]/g)].map(
      (match) => match[1] as string,
    );
    expect(order).toEqual([
      'tailwindcss',
      './tokens.css',
      './theme.css',
      './base.css',
      './motion.css',
    ]);
  });
});
