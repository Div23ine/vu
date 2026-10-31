/**
 * Line classification (Task 85) — maps one human-readable line to the terminal
 * colour the prototype used.
 *
 * Purely presentational: the classification never gates anything and dropping it
 * would not lose data. The scanner conventions are the common ones (`[*]` a
 * success, `[+]` added information, `[!]` a warning, `[!!]` critical, `[~]`/`[-]`
 * muted noise, `$ `/`#` a command the tool echoed).
 *
 * Order matters and is not arbitrary:
 *  - `[!!]` is tested BEFORE `[!]`, otherwise a critical line is misread as a
 *    warning because `[!]` is its prefix.
 *  - `CRITICAL` anywhere in the line is checked alongside `[!!]`, because nmap
 *    and nuclei both emit that word without a bracket marker.
 */

export type LineKind = 'sys' | 'muted' | 'info' | 'ok' | 'warn' | 'crit';

export function classifyLine(line: string): LineKind {
  const trimmed = line.trimStart();

  if (trimmed.startsWith('[!!]') || line.includes('CRITICAL')) return 'crit';
  if (trimmed.startsWith('[*]')) return 'ok';
  if (trimmed.startsWith('[+]')) return 'info';
  if (trimmed.startsWith('[!]')) return 'warn';
  if (trimmed.startsWith('[~]') || trimmed.startsWith('[-]')) return 'muted';
  if (trimmed.startsWith('$ ') || trimmed.startsWith('#')) return 'sys';

  return 'info';
}

/** The terminal's colour token per kind (consumed by the Task 88 stream). */
export const LINE_KIND_ORDER: readonly LineKind[] = [
  'sys',
  'muted',
  'info',
  'ok',
  'warn',
  'crit',
] as const;
