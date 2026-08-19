import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",

      // Legacy PostWP code uses `any` extensively. Keep visibility without
      // blocking production fixes; tighten module-by-module as code is touched.
      "@typescript-eslint/no-explicit-any": "warn",

      // shadcn primitives intentionally use marker interfaces in a few places.
      "@typescript-eslint/no-empty-object-type": "warn",

      // CommonJS is still used by the existing Tailwind config.
      "@typescript-eslint/no-require-imports": "warn",
    },
  },
);
