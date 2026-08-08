// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import sonarjs from 'eslint-plugin-sonarjs';
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
    // Only the complexity rule, not sonarjs' recommended set. AGENTS.md states a hard limit of 15
    // and nothing enforced it, so it was reachable only via SonarCloud after a push — which is how
    // resolveTranslations landed on a PR at 16. Adopting the full ruleset is a separate decision
    // with a much larger blast radius; this closes the gap between the stated rule and the gate.
    files: ['src/**/*.ts'],
    plugins: { sonarjs },
    rules: {
      'sonarjs/cognitive-complexity': ['error', 15],
    },
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
