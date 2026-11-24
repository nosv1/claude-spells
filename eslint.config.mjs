// Lint for the coding standard (nosv1/nosv1 CODING.md; rules in eslint-standard.mjs, a copy of the hub's).
// npm run lint runs this with --max-warnings 0. Old findings are in eslint-suppressions.json, which only
// shrinks: fix them when you're in the file, then npm run lint:prune.
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { linterOptions, standardRules, testRuleOverrides, typeAwareRules } from './eslint-standard.mjs';

const typed = {
  parser: tseslint.parser,
  parserOptions: { project: './tsconfig.json', tsconfigRootDir: import.meta.dirname },
};

export default [
  { ignores: ['node_modules/**', 'worker/.wrangler/**'] },
  { linterOptions },
  {
    // The page: classic scripts loaded in order by index.html, sharing one global scope on purpose. ESLint sees one
    // file at a time, so names from the other scripts look undefined to it: tsc checks undefined names instead.
    files: ['app.js', 'words.js', 'defs.js', 'sync.js', 'draw.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: globals.browser, ...typed },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: { ...standardRules, ...typeAwareRules, 'no-implicit-globals': 'off', 'no-undef': 'off',
      strict: ['error', 'global'] },
  },
  {
    files: ['worker/src/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.serviceworker, ...typed },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: { ...standardRules, ...typeAwareRules },
  },
  {
    // Run inside the headless browser, after the page's scripts, by the smoke test and screenshots (same scope).
    files: ['test/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: globals.browser },
    rules: { ...standardRules, ...testRuleOverrides, 'no-implicit-globals': 'off', 'no-undef': 'off' },
  },
  {
    files: ['test/*.mjs', 'tools/*.mjs', 'eslint.config.mjs', 'eslint-standard.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.node },
    rules: { ...standardRules, ...testRuleOverrides },
  },
];
