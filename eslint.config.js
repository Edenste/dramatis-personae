import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importX from "eslint-plugin-import-x";
import globals from "globals";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "samples/worlds/**", "coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: { allowDefaultProject: ["vitest.config.ts", "eslint.config.js"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { "import-x": importX },
    rules: {
      "import-x/no-extraneous-dependencies": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Vitest's asymmetric matchers (expect.any, expect.stringMatching…) are typed as any.
    files: ["**/*.test.ts"],
    rules: { "@typescript-eslint/no-unsafe-assignment": "off" },
  },
  {
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
);
