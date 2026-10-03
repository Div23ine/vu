// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * VUNVAULT base ESLint flat config.
 * Every workspace lint config must spread this array first.
 */
export const baseConfig = [
  {
    ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/coverage/**', '**/.turbo/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      eqeqeq: 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['express', 'express/*', '@prisma/client', 'prisma', 'joi', '@hapi/joi'],
              message: 'Forbidden by VUNVAULT stack: use Fastify 5 + Drizzle + Zod.',
            },
          ],
        },
      ],
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

export default baseConfig;
