import { defineConfig, mergeConfig } from 'vitest/config';
import { domConfig } from '../../vitest.shared';

/**
 * Web tests run in jsdom (from the shared DOM preset) with two additions:
 *
 *  - `vitest.setup.ts` joins the setup chain: it owns the MSW node-server
 *    lifecycle for every test file.
 *  - `test.env` supplies the required public origins. `src/env.ts` validates
 *    eagerly and throws at import when they are missing, and every module
 *    under test imports it transitively through `lib/api.ts`. These are
 *    throwaway `.test` hosts: MSW intercepts the requests before any DNS
 *    happens, and nothing may resolve to a real origin from a test.
 */
export default mergeConfig(
  domConfig,
  defineConfig({
    // `tsconfig.next.json` pins `jsx: "preserve"` because Next (SWC) owns the
    // JSX transform at build time. Vitest transforms with esbuild instead, so
    // the automatic runtime is selected here explicitly — matching what
    // `tsconfig.react-lib.json` gives the other React workspaces.
    esbuild: { jsx: 'automatic' },
    test: {
      env: {
        NEXT_PUBLIC_API_URL: 'https://api.vunvault.test',
        NEXT_PUBLIC_SITE_URL: 'https://www.vunvault.test',
      },
      setupFiles: ['./vitest.setup.ts'],
    },
  }),
);
