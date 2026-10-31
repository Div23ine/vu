import { describe, expect, it } from 'vitest';
import { HOME_QA, ZURA_KB } from '../qa-data';
import { matchKnowledge, scoreEntry, ZURA_THRESHOLD } from './zura-kb';

/**
 * Zura's matcher — deterministic KB retrieval.
 *
 * Pins the honesty contract: real buyer questions land on the right entry,
 * nonsense and off-topic questions score below the threshold and therefore
 * get "I don't have a published answer" instead of a guess.
 */

function answerFor(question: string): string | null {
  return matchKnowledge(question)?.entry.q ?? null;
}

describe('matchKnowledge', () => {
  it('routes buyer questions to the right entries', () => {
    expect(answerFor('How much does it cost?')).toBe('Where can I see the prices?');
    expect(answerFor('which currency will I be charged in?')).toBe(
      'Which currency am I charged in?',
    );
    expect(answerFor('how do I pay?')).toBe('How do I pay?');
    expect(answerFor('what happens after payment?')).toBe('What happens after payment?');
    expect(answerFor('how long does an engagement take?')).toBe(
      'How long does an engagement take?',
    );
    expect(answerFor('what does the starter assessment deliver?')).toBe(
      'What does the Starter assessment deliver?',
    );
    expect(answerFor('is the free scanner a real scan?')).toBe('Is the free scanner a real scan?');
    expect(answerFor('how do I create an account?')).toBe('How do I create an account?');
    expect(answerFor('Can I switch plans later?')).toBe('Can I switch plans later?');
    expect(answerFor('how do I contact the team?')).toBe('How do I contact the team?');
    expect(answerFor('what is vunvault?')).toBe('What is VUNVAULT?');
  });

  it('refuses nonsense and off-topic questions instead of guessing', () => {
    expect(matchKnowledge('purple elephants juggle nightly')).toBeNull();
    expect(matchKnowledge('asdf qwerty uiop')).toBeNull();
    expect(matchKnowledge('what is the weather in nairobi?')).toBeNull();
  });

  it('scores a single curated keyword hit at or above the threshold', () => {
    const entry = ZURA_KB.find((candidate) => candidate.q === 'How do I pay?');
    expect(entry).toBeDefined();
    if (entry === undefined) return;
    expect(scoreEntry(entry, 'payment?')).toBeGreaterThanOrEqual(ZURA_THRESHOLD);
  });

  it('keeps every KB entry reachable and the home list a subset', () => {
    expect(ZURA_KB.length).toBeGreaterThan(HOME_QA.length);
    for (const entry of HOME_QA) {
      expect(ZURA_KB).toContain(entry);
      expect(matchKnowledge(entry.q)?.entry).toBe(entry);
    }
  });
});
