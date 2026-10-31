import { ZURA_KB, type QaEntry } from '../qa-data';

/**
 * Zura's on-device matcher — deterministic, dependency-free and fully
 * testable.
 *
 * Scoring: a keyword phrase or stemmed token present in the question is
 * worth +3 (keywords are each entry's curated vocabulary); every content
 * token (3+ chars) shared between the question and the entry's own question
 * text adds +1 to break ties. An entry qualifies only on curated keyword
 * evidence (`keywordScore` at or above `ZURA_THRESHOLD`) — generic word
 * overlap alone can never trigger an answer, and anything below the bar
 * means "no published answer", which the widget says instead of guessing.
 * The honesty rule applies to the chatbot too.
 */

export const ZURA_THRESHOLD = 3;

const TOKEN = /[a-z0-9]+/g;

function tokens(text: string): string[] {
  return (text.toLowerCase().match(TOKEN) ?? []).filter((token) => token.length > 2);
}

export interface ZuraMatch {
  entry: QaEntry;
  score: number;
}

/** Curated-vocabulary evidence for one entry against a question. */
export function keywordScore(entry: QaEntry, question: string): number {
  const haystack = ` ${question.toLowerCase()} `;
  let score = 0;
  for (const keyword of entry.keywords) {
    // A hit (phrase, or stemmed single token like "pay" inside "payment")
    // is enough on its own to clear the threshold.
    if (haystack.includes(keyword)) score += 3;
  }
  return score;
}

/** Total score: keyword evidence plus shared-token tiebreak. Exported for tests. */
export function scoreEntry(entry: QaEntry, question: string): number {
  const questionTokens = new Set(tokens(question));
  let overlap = 0;
  for (const token of new Set(tokens(entry.q))) {
    if (questionTokens.has(token)) overlap += 1;
  }
  return keywordScore(entry, question) + overlap;
}

/** Best matching KB entry above the threshold, or null when none qualifies. */
export function matchKnowledge(question: string): ZuraMatch | null {
  let best: ZuraMatch | null = null;
  for (const entry of ZURA_KB) {
    if (keywordScore(entry, question) < ZURA_THRESHOLD) continue;
    const score = scoreEntry(entry, question);
    if (score > (best?.score ?? 0)) best = { entry, score };
  }
  return best;
}

/** Three starter prompts the widget offers before the first question. */
export const ZURA_SUGGESTIONS: readonly string[] = [
  'Which currency am I charged in?',
  'What happens after payment?',
  'Is the free scanner a real scan?',
];
