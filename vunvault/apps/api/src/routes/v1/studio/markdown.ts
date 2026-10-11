/**
 * Markdown sanitising for the Content Studio.
 *
 * The API stores Markdown and never renders it — the web app renders it with a
 * safe renderer — but storage is not a reason to keep an executable payload. An
 * author who is compromised, or merely careless, must not be able to park
 * `<script>` or a `javascript:` link in the database for a reader to trip over
 * later, and a moderator must not have to spot it by eye.
 *
 * What survives: `**bold**`, `*italic*`, `` `code` ``, fenced code, `[text](https://…)`,
 * `##`/`###` headings, `-` lists and `>` quotes.
 * What does not: raw HTML tags, the contents of `script`/`style`/`iframe`/`object`/
 * `embed`/`svg`/`math` elements, and any link or image target that is not http,
 * https, mailto or relative.
 *
 * There is deliberately no HTML parsing library here: the input is Markdown, the
 * output is Markdown, and the only HTML in it is HTML that should not exist.
 */

/** Elements whose CONTENT is removed with them, not just their tags. */
const DANGEROUS_ELEMENTS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'template',
];

/** Schemes a link may use. Everything else is dropped, target and all. */
const SAFE_SCHEMES = ['http:', 'https:', 'mailto:'];

/** A tag: `<name …>`, `</name>`, `<!-- … -->`, `<?php …`, `<!DOCTYPE …`. */
const HTML_TAG = /<\/?[a-z!?][^>]*>/gi;
const HTML_COMMENT = /<!--[\s\S]*?-->/gi;

/** `[label](target "title")` and `![alt](target)`. */
const LINK = /(!?)\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;

/** A bare autolink in angle brackets: `<https://example.test>`. */
const AUTOLINK = /<((?:https?|mailto):[^>\s]+)>/gi;

export interface SanitiseResult {
  text: string;
  /** True when something had to be removed. Surfaced to the author, not stored. */
  changed: boolean;
}

/** Remove a dangerous element together with everything between its tags. */
function stripDangerousElements(input: string): string {
  let text = input;
  for (const element of DANGEROUS_ELEMENTS) {
    const paired = new RegExp(`<${element}\\b[^>]*>[\\s\\S]*?<\\/${element}\\s*>`, 'gi');
    text = text.replace(paired, '');
    // An unpaired opening tag is still an attempt; the tag stripper catches it.
  }
  return text;
}

/** Decode percent-escapes (twice: `%253A` is `:` after two passes) for a scheme check. */
function decodeForSchemeCheck(target: string): string {
  let decoded = target;
  for (let pass = 0; pass < 2; pass += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
}

/**
 * True when a link target is safe to keep.
 *
 * Control characters and whitespace are removed first, because `java\tscript:` and
 * `java script:` are the same scheme to a browser.
 */
/** Drop spaces and control characters: `java\tscript:` is `javascript:` to a browser. */
function stripSpaceAndControlCharacters(target: string): string {
  let kept = '';
  for (const character of target) {
    const code = character.codePointAt(0) ?? 0;
    if (code > 0x20 && code !== 0x7f) kept += character;
  }
  return kept;
}

export function isSafeLinkTarget(target: string): boolean {
  const cleaned = decodeForSchemeCheck(stripSpaceAndControlCharacters(target)).toLowerCase();
  if (cleaned === '') return false;

  const schemeMatch = /^([a-z0-9+.-]+):/.exec(cleaned);
  if (schemeMatch === null) {
    // Relative: a path, a fragment, or a protocol-relative URL.
    return !cleaned.startsWith('//');
  }
  return SAFE_SCHEMES.includes(`${schemeMatch[1]}:`);
}

/** Rewrite one link, keeping the label when the target has to go. */
function sanitiseLink(_match: string, bang: string, label: string, target: string): string {
  if (isSafeLinkTarget(target)) return `${bang}[${label}](${target})`;
  // The words stay, the payload does not.
  return label;
}

export function sanitiseMarkdown(input: string): string {
  return sanitise(input).text;
}

export function sanitise(input: string): SanitiseResult {
  let text = input;
  text = stripDangerousElements(text);
  text = text.replace(HTML_COMMENT, '');
  // Angle-bracket autolinks are legitimate Markdown; keep the URL, drop the brackets.
  text = text.replace(AUTOLINK, '$1');
  text = text.replace(LINK, sanitiseLink);
  text = text.replace(HTML_TAG, '');

  return { text, changed: text !== input };
}

/**
 * Normalise tags: lower-cased, `#` stripped, de-duplicated, capped at eight.
 * The cap is also a database check, so it is enforced here rather than trusted.
 */
export function normaliseTags(tags: readonly string[], max = 8): string[] {
  const seen = new Set<string>();
  for (const tag of tags) {
    const cleaned = tag.trim().toLowerCase().replace(/^#+/, '');
    if (cleaned === '') continue;
    seen.add(cleaned);
    if (seen.size === max) break;
  }
  return [...seen];
}
