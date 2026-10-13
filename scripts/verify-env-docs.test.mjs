import { strict as assert } from 'node:assert';
import test, { describe } from 'node:test';
import { checkEnvDocs, extractExampleNames, extractSchemaNames } from './verify-env-docs.mjs';

/**
 * The env-docs drift gate's tests (Task 103): extraction is exact, and both
 * drift directions are caught — an undocumented variable and a stale example
 * entry are the same failure wearing different clothes.
 */

const SCHEMA_TEXT = `
import { z } from 'zod';
export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    /** A comment mentioning FOO_BAR must not count. */
    REDIS_URL: z.string().url(),
    OPTIONAL_THING: z.string().optional(),
  });
`;

const WEB_TEXT = `
// The header says process.env.NEXT_PUBLIC_X is replaced statically — prose.
const value = process.env.NEXT_PUBLIC_API_URL ?? '';
const other = process.env.NEXT_PUBLIC_R2_HOST;
`;

describe('extractSchemaNames', () => {
  test('reads zod fields at any indentation and ignores comments', () => {
    const names = extractSchemaNames(SCHEMA_TEXT).sort();
    assert.deepEqual(names, ['NODE_ENV', 'OPTIONAL_THING', 'REDIS_URL']);
  });

  test('reads NEXT_PUBLIC_* assembly and not the prose example', () => {
    const names = extractSchemaNames(WEB_TEXT).sort();
    assert.deepEqual(names, ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_R2_HOST']);
  });
});

describe('extractExampleNames', () => {
  test('reads commented and uncommented entries', () => {
    assert.deepEqual(
      extractExampleNames('# REDIS_URL=\nDATABASE_URL=   # pooler\nNOT_A_LINE\n').sort(),
      ['DATABASE_URL', 'REDIS_URL'],
    );
  });
});

describe('checkEnvDocs', () => {
  const base = {
    schemaNames: { api: ['NODE_ENV', 'REDIS_URL'] },
    envReference: 'docs mention NODE_ENV and REDIS_URL',
    exampleEntries: new Map([['apps/api/.env.example', ['NODE_ENV', 'REDIS_URL']]]),
  };

  test('a consistent trio passes', () => {
    assert.deepEqual(checkEnvDocs(base), []);
  });

  test('code → docs drift is caught', () => {
    const violations = checkEnvDocs({
      ...base,
      envReference: 'docs mention NODE_ENV only',
    });
    assert.ok(violations.some((v) => v.includes('REDIS_URL') && v.includes('env-reference')));
  });

  test('code → example drift is caught', () => {
    const violations = checkEnvDocs({
      ...base,
      exampleEntries: new Map([['apps/api/.env.example', ['NODE_ENV']]]),
    });
    assert.ok(violations.some((v) => v.includes('REDIS_URL') && v.includes('in no .env.example')));
  });

  test('example → code drift (stale entry) is caught', () => {
    const violations = checkEnvDocs({
      ...base,
      exampleEntries: new Map([
        ['apps/api/.env.example', ['NODE_ENV', 'REDIS_URL', 'GHOST_VARIABLE']],
      ]),
      declared: new Set(['NODE_ENV', 'REDIS_URL']),
    });
    assert.ok(violations.some((v) => v.includes('GHOST_VARIABLE') && v.includes('stale')));
  });

  test('the reviewed non-schema allow-list is honoured', () => {
    const violations = checkEnvDocs({
      ...base,
      exampleEntries: new Map([['apps/api/.env.example', ['NODE_ENV', 'REDIS_URL', 'DIRECT_URL']]]),
      declared: new Set(['NODE_ENV', 'REDIS_URL']),
    });
    assert.deepEqual(violations, []);
  });
});
