// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.js', '*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    // bun-types types expect().rejects/.resolves as sync Matchers returning void, so the
    // runtime-required await on async assertions reads as await-of-non-thenable. Scoped off here.
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/await-thenable': 'off',
    },
  }
);
