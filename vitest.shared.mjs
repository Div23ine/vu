/**
 * Shared Vitest configs for VUNVAULT workspaces.
 *
 * `nodeConfig` targets Node-side workspaces (api, workers, db, contracts);
 * `domConfig` targets DOM-side workspaces (ui, lib, web) and wires up the
 * repo-root setup file (jest-dom matchers + Testing Library cleanup).
 *
 * Plain data objects (no framework helpers) so they can be merged with
 * `mergeConfig` from `vitest/config` in each workspace's `vitest.config.ts`.
 */
export const nodeConfig = {
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
};

export const domConfig = {
  test: {
    environment: 'jsdom',
    setupFiles: ['../../vitest.setup.dom.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
};
