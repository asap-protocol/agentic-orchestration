import js from "@eslint/js"
import ts from "typescript-eslint"
import reactHooks from "eslint-plugin-react-hooks"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  ...nextVitals,
  ...nextTypescript,
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "@next/next/no-html-link-for-pages": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/components/**/*.tsx", "src/app/**/*.tsx"],
    ignores: [
      "src/components/ui/**",
      "src/components/builder/edges/*.test.tsx",
      "src/lib/design-tokens.ts",
      "src/lib/auth-styles.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/\\b(text|bg|border)-(zinc|indigo|violet|gray)-/]",
          message:
            "Design System §8: Use semantic tokens (bg-muted, text-primary, etc.) instead of generic palette colors. See design-system-agent-builder.md §8.2.",
        },
      ],
    },
  },
]
