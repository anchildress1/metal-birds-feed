// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  // worker/ is a standalone Cloudflare deployable with its own tsconfig + workers-types; its
  // Cloudflare-runtime entry is not part of this typed-lint project. Its business logic lives in
  // src/worker/ and is linted here like any other source.
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'worker/**'] },
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
