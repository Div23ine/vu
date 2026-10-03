// @ts-check
import globals from 'globals';
import { baseConfig } from './eslint.base.mjs';

/**
 * VUNVAULT ESLint flat config for Node workspaces (apps/api, workers, scripts).
 * Base + node globals.
 */
export const nodeConfig = [
  ...baseConfig,
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
];

export default nodeConfig;
