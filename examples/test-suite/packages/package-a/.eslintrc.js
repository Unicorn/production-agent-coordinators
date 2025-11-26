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
    project: './tsconfig.json', // Required for rules that need type information
  },
  plugins: [
    '@typescript-eslint',
    'prettier',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking', // For strict type-aware rules
    'plugin:prettier/recommended', // Integrates prettier with eslint
  ],
  rules: {
    // Bernier LLC specific rules
    'prettier/prettier': 'error',
    '@typescript-eslint/no-explicit-any': 'error', // Explicitly forbid 'any'
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-unused-vars': 'off', // Disable base ESLint rule
    '@typescript-eslint/no-floating-promises': 'error', // Ensure promises are handled
    '@typescript-eslint/semi': ['error', 'always'], // Require semicolons
    'semi': 'off', // Disable base ESLint semi rule
    'prefer-const': 'error', // Enforce const for variables that are not reassigned
    'no-var': 'error', // Disallow var
    '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
    '@typescript-eslint/consistent-type-definitions': ['error', 'interface'], // Enforce interfaces for object type definitions
    '@typescript-eslint/explicit-module-boundary-types': ['error', { allowArgumentsExplicitlyTypedAsAny: false }], // Enforce explicit return and parameter types for all exported functions
    '@typescript-eslint/no-shadow': ['error'], // Disallow variable shadowing
    'no-shadow': 'off', // Disable base ESLint rule
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'interface',
        format: ['PascalCase'],
      },
      {
        selector: 'typeAlias',
        format: ['PascalCase'],
      },
      {
        selector: 'variableLike',
        format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
        leadingUnderscore: 'allow',
      },
      {
        selector: 'function',
        format: ['camelCase', 'PascalCase'],
      },
      {
        selector: 'enumMember',
        format: ['PascalCase', 'UPPER_CASE'],
      },
      {
        selector: ['classProperty', 'objectLiteralProperty', 'typeProperty', 'classMethod', 'parameterProperty'],
        format: ['camelCase', 'PascalCase', 'UPPER_CASE', 'snake_case'],
      },
    ],
  },
  ignorePatterns: [
    "dist/",
    "node_modules/",
    "coverage/",
    "*.js",
    "*.d.ts",
    "jest.config.js",
    ".eslintrc.js"
  ],
};