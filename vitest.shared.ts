import { fileURLToPath } from 'node:url';
import type { UserConfig } from 'vitest/config';

/**
 * Shared Vitest presets. Workspaces merge one of these into their own
 * `vitest.config.ts` so every package tests with identical semantics.
 */

/** Absolute path to the DOM setup file, resolved from this module's location. */
const domSetupFile = fileURLToPath(new URL('./vitest.setup.dom.ts', import.meta.url));

/** Node environment — backend packages, schemas and pure helpers. */
export const nodeConfig: UserConfig = {
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    restoreMocks: true,
    unstubEnvs: true,
  },
};

/** jsdom environment — React component packages. */
export const domConfig: UserConfig = {
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: [domSetupFile],
    passWithNoTests: true,
    restoreMocks: true,
    unstubEnvs: true,
  },
};
