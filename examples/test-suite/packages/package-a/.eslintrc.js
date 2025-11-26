/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: [
    '@typescript-eslint',
    'prettier',
    'promise',
    'import',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:prettier/recommended',
    'plugin:promise/recommended',
    'plugin:import/typescript',
  ],
  rules: {
    // Bernier LLC specific rules for strictness and quality
    'no-unused-vars': 'off', // Turn off base rule, use TS version
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowBoolean: true }],
    '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/strict-boolean-expressions': ['error', {
      allowNullableBoolean: true,
      allowNullableString: true,
      allowNullableNumber: true,
      allowAny: false,
    }],
    // Ensure all promises are handled
    'promise/always-return': 'off', // Sometimes a promise doesn't need to return another promise
    'promise/catch-or-return': 'error', // Must catch or return
    'promise/no-return-wrap': 'error',
    'promise/param-names': 'error',
    'promise/no-nesting': 'warn',
    'promise/no-promise-in-callback': 'warn',
    'promise/no-callback-in-promise': 'warn',
    'promise/avoid-new': 'off', // New promises are acceptable if handled correctly
    'promise/no-native': 'off', // We use native Promises
    'promise/prefer-await-to-then': 'error', // Prefer async/await over .then()
    'promise/valid-params': 'error',
    'promise/no-multiple-resolved': 'error',
    'promise/prefer-await-to-callbacks': 'error',

    // Prettier specific rules
    'prettier/prettier': [
      'error',
      {
        semi: true,
        singleQuote: true,
        printWidth: 120,
        trailingComma: 'all',
      },
    ],
    'indent': 'off', // Prettier handles this
    'quotes': 'off', // Prettier handles this
    'semi': 'off',   // Prettier handles this

    // Import sorting
    'import/order': ['error', {
      'groups': ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
      'newlines-between': 'always',
      'alphabetize': { 'order': 'asc', 'caseInsensitive': true },
    }],
    'import/no-duplicates': 'error',
    'import/no-unresolved': 'error',
    'import/named': 'error',
  },
  settings: {
    'import/resolver': {
      typescript: {
        project: './tsconfig.json',
      },
    },
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'jest.config.ts', // Usually handled separately or not linted
    '*.js', // Lint only TS files
    '*.d.ts', // Declaration files are generated
  ],
};