/**
 * Mirror of `styles/tokens.css` for consumers that cannot read CSS custom
 * properties — Recharts series colours, canvas drawing, chart tooltips.
 *
 * This is the ONLY TypeScript file in the repository allowed to contain hex
 * literals, and `tokens.test.ts` fails the build if it drifts from `tokens.css`.
 * Everything else must use the Tailwind token classes.
 */
export const tokens = {
  color: {
    brand: '#3B99FC',
    brandStrong: '#1E7BE0',
    brandSoft: '#6FB6FF',
    dark: '#0A0D12',
    paper: '#fcfbf9',
    ink: '#171717',
    inkSoft: '#525252',
    inkMuted: '#737373',
    inkFaint: '#a3a3a3',
    line: '#e5e5e5',
    critical: '#f43f5e',
    high: '#f59e0b',
    medium: '#eab308',
    low: '#3B99FC',
    ok: '#10b981',
  },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 9999 },
  motion: { ease: 'cubic-bezier(0.4,0,0.2,1)', easeOut: 'cubic-bezier(0,0,0.2,1)', durMs: 200 },
} as const;

export type Tokens = typeof tokens;
export type TokenColor = keyof Tokens['color'];
export type TokenRadius = keyof Tokens['radius'];
