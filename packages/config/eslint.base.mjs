import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Paths that are never linted, in any workspace. */
export const sharedIgnores = [
  '**/node_modules/**',
  '**/.next/**',
  '**/dist/**',
  '**/coverage/**',
  '**/.turbo/**',
];

const FORBIDDEN_STACK_MESSAGE = 'Forbidden by VUNVAULT stack: use Fastify 5 + Drizzle + Zod.';
const WEB_STORAGE_MESSAGE = 'Sessions live in HttpOnly cookies; do not use web storage.';

/**
 * Base flat config: JavaScript recommended rules + strict TypeScript rules +
 * the mechanical stack guards (no Express / Prisma / Joi, no web storage).
 */
const baseConfig = [
  { ignores: sharedIgnores },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.es2021,
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['express', 'express/*'], message: FORBIDDEN_STACK_MESSAGE },
            { group: ['@prisma/client', 'prisma'], message: FORBIDDEN_STACK_MESSAGE },
            { group: ['joi', '@hapi/joi'], message: FORBIDDEN_STACK_MESSAGE },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: WEB_STORAGE_MESSAGE },
        { name: 'sessionStorage', message: WEB_STORAGE_MESSAGE },
      ],
    },
  },
  prettier,
];

export default baseConfig;
