import openWc from '@open-wc/eslint-config';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
  ...openWc,
  {
    files: ['*.config.js'],
    languageOptions: { globals: { process: 'readonly' } },
  },
  prettier,
];
