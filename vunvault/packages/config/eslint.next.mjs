import { existsSync } from 'node:fs';
import nextPlugin from '@next/eslint-plugin-next';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import baseConfig from './eslint.base.mjs';

/**
 * `@next/next/no-html-link-for-pages` builds its route list from a Next.js `app/`
 * or `pages/` directory. Library workspaces (`packages/ui`, `packages/lib`) share
 * this config but contain neither, so the rule is switched off there to keep the
 * lint output free of plugin warnings. In `apps/web` it stays on.
 */
const hasNextRoutes = ['app', 'src/app', 'pages', 'src/pages'].some((dir) => existsSync(dir));

const nextAppOnlyRules = hasNextRoutes ? {} : { '@next/next/no-html-link-for-pages': 'off' };

/**
 * Flat config for React workspaces (`apps/web`, `packages/ui`, `packages/lib`):
 * base rules + react + react-hooks + jsx-a11y recommended + @next/next recommended.
 */
const nextConfig = [
  ...baseConfig,
  {
    files: ['**/*.tsx', '**/*.jsx'],
    ...react.configs.flat.recommended,
    settings: {
      react: { version: '19.0' },
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      // TypeScript owns prop typing; `prop-types` only produces false positives here.
      'react/prop-types': 'off',
      // Every workspace compiles with the automatic JSX runtime (`jsx: "react-jsx"`),
      // so `import React from 'react'` is not required — or wanted — in a component file.
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
    },
  },
  {
    files: ['**/*.tsx', '**/*.jsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['**/*.tsx', '**/*.jsx'],
    ...jsxA11y.flatConfigs.recommended,
  },
  {
    files: ['**/*.tsx', '**/*.jsx', '**/*.ts', '**/*.js', '**/*.mjs'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextAppOnlyRules,
    },
  },
];

export default nextConfig;
