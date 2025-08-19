import js from '@eslint/js';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2022,
        ...globals.browser,
      },
    },
    rules: {
      // Possible Errors
      'no-console': 'off', // Allow console logs for this project
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-undef': 'error',

      // Best Practices
      eqeqeq: ['error', 'always'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'prefer-const': 'error',
      'no-var': 'error',

      // ES6+
      'prefer-template': 'error',
      'prefer-arrow-callback': 'error',
    },
  },
  {
    files: ['**/*.test.js', 'test-*.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.mocha,
      },
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'apps/keys-manager.json',
      '**/*.scraped.*',
    ],
  },
  // Prettier config should be last to override any conflicting rules
  prettierConfig,
];
