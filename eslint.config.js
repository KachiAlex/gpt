import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import react from 'eslint-plugin-react'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'backend/dist', 'backend/coverage', 'node_modules']),
  // Node-env files (jest config, scripts) — not browser code
  {
    files: ['backend/**/*.js', '*.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['**/*.{js,jsx}'],
    plugins: { react },
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      // Without this, identifiers only referenced inside JSX (<Icon />) read as unused
      'react/jsx-uses-vars': 'error',
    },
  },
  // Contexts and shared-UI modules legitimately export both components and
  // hooks/constants — fast-refresh's component-only rule doesn't apply
  {
    files: ['src/contexts/**', 'src/components/ui/**', 'src/pages/MapView.jsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
