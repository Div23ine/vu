import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Shared VUNVAULT ESLint 9 flat-config base: strict TS rules plus the stack
 * guardrails (no Express/Prisma/Joi imports, no web storage globals).
 * Consumed by eslint.next.mjs and eslint.node.mjs.
 */
const FORBIDDEN_IMPORT_MESSAGE = "Forbidden by VUNVAULT stack: use Fastify 5 + Drizzle + Zod.";
const WEB_STORAGE_MESSAGE = "Sessions live in HttpOnly cookies; do not use web storage.";

export const ignores = ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/coverage/**", "**/.turbo/**"];

export const restrictedImportPatterns = [
  { group: ["express"], message: FORBIDDEN_IMPORT_MESSAGE },
  { group: ["express/*"], message: FORBIDDEN_IMPORT_MESSAGE },
  { group: ["@prisma/client"], message: FORBIDDEN_IMPORT_MESSAGE },
  { group: ["prisma"], message: FORBIDDEN_IMPORT_MESSAGE },
  { group: ["joi"], message: FORBIDDEN_IMPORT_MESSAGE },
  { group: ["@hapi/joi"], message: FORBIDDEN_IMPORT_MESSAGE },
];

export const restrictedGlobals = [
  { name: "localStorage", message: WEB_STORAGE_MESSAGE },
  { name: "sessionStorage", message: WEB_STORAGE_MESSAGE },
];

const config = tseslint.config(
  { ignores },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    name: "vunvault/base",
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      eqeqeq: "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-restricted-imports": ["error", { patterns: restrictedImportPatterns }],
      "no-restricted-globals": ["error", ...restrictedGlobals],
    },
  },
);

export default config;
