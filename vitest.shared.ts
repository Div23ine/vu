import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Absolute path to the repo-root DOM test setup file (shared by all workspace packages). */
const domSetupFile = fileURLToPath(new URL('./vitest.setup.dom.ts', import.meta.url));

/** Shared Vitest config for Node workspaces (apps/api, workers, packages/db, packages/contracts). */
export const nodeConfig = defineConfig({
  test: {
    environment: 'node',
  },
});

/** Shared Vitest config for DOM workspaces (apps/web, packages/ui, packages/lib). */
export const domConfig = defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: [domSetupFile],
  },
});
