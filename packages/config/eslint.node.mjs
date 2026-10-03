import globals from "globals";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";
import base, { ignores } from "./eslint.base.mjs";

/**
 * Flat config for Node 22 workspaces (API, workers, scripts):
 * base rules + Node globals, Prettier compat last.
 */
const config = tseslint.config(
  { ignores },
  ...base,
  {
    name: "vunvault/node",
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2023 },
    },
  },
  prettier,
);

export default config;
