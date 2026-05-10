import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import eslintConfigPrettier from 'eslint-config-prettier'
import noDirectStorageAccess from './eslint-rules/no-direct-storage-access.js'

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'coverage/', 'playwright-report/', 'e2e-results/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
      'custom-rules': { rules: { 'no-direct-storage-access': noDirectStorageAccess } },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'custom-rules/no-direct-storage-access': 'error',
    },
  },
  eslintConfigPrettier,
)
