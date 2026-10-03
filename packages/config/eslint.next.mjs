import nextPlugin from "@next/eslint-plugin-next";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";
import base, { ignores } from "./eslint.base.mjs";

/** @type {Record<string, unknown>} */
const reactRecommendedRules = react.configs.flat.recommended.rules;
/** @type {Record<string, unknown>} */
const jsxA11yRecommendedRules = jsxA11y.configs.recommended.rules;
/** @type {Record<string, unknown>} */
const nextRecommendedRules = nextPlugin.configs.recommended.rules;

/**
 * Flat config for Next.js 15 App Router workspaces (apps/web):
 * base rules + React, react-hooks (rules-of-hooks and exhaustive-deps as errors),
 * the jsx-a11y recommended set, @next/next recommended, then Prettier compat last.
 */
const config = tseslint.config(
  { ignores },
  ...base,
  {
    name: "vunvault/react",
    files: ["**/*.{ts,tsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
      "@next/next": nextPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...reactRecommendedRules,
      ...jsxA11yRecommendedRules,
      ...nextRecommendedRules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
  },
  prettier,
);

export default config;
