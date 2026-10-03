import globals from 'globals';
import tseslint from 'typescript-eslint';
import { createBaseConfig } from './eslint.base.mjs';

export default tseslint.config(
  ...createBaseConfig(),
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2023,
      },
    },
  },
);
