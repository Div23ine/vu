// Ambient declarations for ESLint plugins that ship no type definitions.
// Scoped to this package so `tsc --checkJs` stays strict and error-free.
declare module 'eslint-config-prettier' {
  const config: { rules: Record<string, 'off'> };
  export default config;
}

declare module 'eslint-plugin-jsx-a11y' {
  interface FlatA11yConfig {
    rules: Record<string, unknown>;
  }
  const plugin: {
    flatConfigs: { recommended: FlatA11yConfig };
    rules: Record<string, unknown>;
  };
  export default plugin;
}
