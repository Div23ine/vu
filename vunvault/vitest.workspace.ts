import { defineWorkspace } from 'vitest/config';

/** Every workspace that owns a Vitest config participates in a root-level `vitest` run. */
export default defineWorkspace(['apps/*/vitest.config.ts', 'packages/*/vitest.config.ts']);
