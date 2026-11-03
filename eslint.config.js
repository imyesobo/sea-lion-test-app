import js from '@eslint/js';
import openWc from '@open-wc/eslint-config';
import litPlugin from 'eslint-plugin-lit';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/', 'coverage/', 'dist/', 'custom-elements.json'],
  },
  js.configs.recommended,
  litPlugin.configs['flat/recommended'],
  ...openWc,
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Provider clients use the template-method pattern: hooks such as `_body()`
    // or `_parseCompletion()` are overridable instance methods by design.
    files: ['src/services/clients/**/*.js'],
    rules: {
      'class-methods-use-this': 'off',
    },
  },
  {
    files: ['*.config.{js,mjs}', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  prettierConfig,
];
