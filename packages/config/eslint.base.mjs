import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export const forbiddenImportPatterns = [
  {
    group: ['express', 'express/*', '@prisma/client', 'prisma', 'joi', '@hapi/joi'],
    message: 'Forbidden by VUNVAULT stack: use Fastify 5 + Drizzle + Zod.',
  },
];

export const forbiddenGlobalNames = [
  {
    name: 'localStorage',
    message: 'Sessions live in HttpOnly cookies; do not use web storage.',
  },
  {
    name: 'sessionStorage',
    message: 'Sessions live in HttpOnly cookies; do not use web storage.',
  },
];

const ignores = [
  '**/node_modules/**',
  '**/.next/**',
  '**/dist/**',
  '**/coverage/**',
  '**/.turbo/**',
];

/**
 * Base flat config shared by every VUNVAULT workspace.
 * @returns {import('eslint').Linter.Config[]}
 */
export function createBaseConfig() {
  return tseslint.config(
    { ignores },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
      languageOptions: {
        ecmaVersion: 2023,
        sourceType: 'module',
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { prefer: 'type-imports' },
        ],
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_' },
        ],
        eqeqeq: 'error',
        'no-console': ['warn', { allow: ['warn', 'error'] }],
        'no-restricted-imports': ['error', { patterns: forbiddenImportPatterns }],
        'no-restricted-globals': ['error', ...forbiddenGlobalNames],
      },
    },
    prettier,
  );
}

export default createBaseConfig();
