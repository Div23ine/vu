import { defineWorkspace } from 'vitest/config';

/**
 * All VUNVAULT vitest projects. Each workspace entry resolves to that
 * workspace's own `vitest.config.ts` (which merges either `nodeConfig` or
 * `domConfig` from `vitest.shared.ts`). Workspaces without a config are
 * skipped by Vitest's project discovery.
 */
export default defineWorkspace(['apps/*', 'packages/*']);
