/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
    'prettier'
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended'
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  env: {
    node: true,
    jest: true
  },
  rules: {
    // Custom rules and overrides
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-module-boundary-types': 'off', // Can be too restrictive for utility functions
    '@typescript-eslint/no-explicit-any': 'error', // Enforce strict typing
    '@typescript-eslint/no-floating-promises': 'error', // Crucial for async/await
    '@typescript-eslint/no-inferrable-types': ['warn', {
      ignoreParameters: true,
      ignoreProperties: true
    }],
    'prettier/prettier': 'error',
    'no-unused-vars': 'off', // Disable base ESLint rule as TS version is used
    'no-console': ['warn', { allow: ['warn', 'error'] }], // Allow console.warn and console.error
    'prefer-const': 'error',
    '@typescript-eslint/await-thenable': 'error', // Ensure await is used on thenable values
    '@typescript-eslint/no-misused-promises': ['error', {
      checksVoidReturn: false // Allow `void` functions to not be awaited if explicitly intended
    }],
    '@typescript-eslint/restrict-template-expressions': ['warn', {
      allowAny: true // Allow string interpolation with any type for simplicity in some cases
    }]
  },
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/']
};
```