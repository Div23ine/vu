/**
 * Shared Prettier configuration for every VUNVAULT workspace.
 * Workspaces re-export this file instead of declaring their own formatting rules.
 */
const prettierConfig = {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  arrowParens: 'always',
};

export default prettierConfig;
