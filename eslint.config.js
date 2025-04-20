import js from '@eslint/js';
import json from '@eslint/json';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginImport from 'eslint-plugin-import';
import eslintPluginPrettier from 'eslint-plugin-prettier';
// eslint-disable-next-line import/no-unresolved
import { defineConfig } from 'eslint/config';
import globals from 'globals';

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs}'],
    plugins: { js, prettier: eslintPluginPrettier, import: eslintPluginImport },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.node },
    rules: {
      'import/no-unresolved': 'error',
    },
  },
  { files: ['**/*.json'], plugins: { json }, language: 'json/json', extends: ['json/recommended'] },
  { files: ['**/*.jsonc'], plugins: { json }, language: 'json/jsonc', extends: ['json/recommended'] },
  eslintConfigPrettier, // disables conflicting ESLint rules
]);
