import js from "@eslint/js";
import globals from "globals";

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**"]
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "error"
    }
  }
];

export default eslintConfig;
