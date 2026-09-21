const js = require("@eslint/js");
const globals = require("globals");
const eslintConfigPrettier = require("eslint-config-prettier");

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "frontend/**",
      "public/**",
      "src/uploads/**",
      "**/*.min.js",
      "package-lock.json",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Baseline do projeto ainda não estava sob lint: manter como avisos os
      // problemas pré-existentes, sem bloquear o gate por código legado.
      "no-unused-vars": ["warn", { args: "after-used", caughtErrors: "none" }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-console": "off",
      "no-useless-escape": "warn",
    },
  },
  eslintConfigPrettier,
];
