#!/usr/bin/env node
/**
 * lint-staged ESLint runner.
 *
 * lint-staged invokes its commands from the repository root, but every
 * workspace owns its own `eslint.config.mjs` — and only that config knows the
 * workspace's plugins (for example `@next/next` in `apps/web` and, through the
 * shared React config, in `packages/ui`). Running plain `eslint` from the root
 * applies the root's base config to every staged file, and any
 * `eslint-disable` directive referencing a workspace-specific rule then fails
 * with "Definition for rule … was not found".
 *
 * This wrapper groups the staged files by their nearest ancestor
 * `eslint.config.mjs` and runs ESLint from that directory, so the pre-commit
 * hook lints with exactly the same configuration as `pnpm --filter <pkg> lint`.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

const repoRoot = process.cwd();
const files = process.argv.slice(2);

function findConfigDir(file) {
  let dir = dirname(resolve(repoRoot, file));
  for (;;) {
    if (existsSync(resolve(dir, 'eslint.config.mjs'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return repoRoot;
    dir = parent;
  }
}

const groups = new Map();
for (const file of files) {
  const dir = findConfigDir(file);
  const group = groups.get(dir);
  const absolute = resolve(repoRoot, file);
  if (group === undefined) {
    groups.set(dir, [relative(dir, absolute)]);
  } else {
    group.push(relative(dir, absolute));
  }
}

let failed = false;
for (const [dir, group] of groups) {
  const result = spawnSync('pnpm', ['exec', 'eslint', '--fix', ...group], {
    cwd: dir,
    stdio: 'inherit',
  });
  if (result.status !== 0) failed = true;
}

process.exit(failed ? 1 : 0);
