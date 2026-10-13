import globals from 'globals';
import baseConfig from './eslint.base.mjs';

/**
 * Flat config for Node workspaces (`apps/api`, the three workers,
 * `packages/db`, `packages/contracts`): base rules + Node globals, no browser globals.
 */
const nodeConfig = [
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.mts', '**/*.cts', '**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      // Web storage does not exist in Node; keep the guard explicit for shared code.
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message: 'Sessions live in HttpOnly cookies; do not use web storage.',
        },
        {
          name: 'sessionStorage',
          message: 'Sessions live in HttpOnly cookies; do not use web storage.',
        },
      ],
    },
  },
];

export default nodeConfig;
