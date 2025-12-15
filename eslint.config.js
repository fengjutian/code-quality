const globals = require('globals');
const pluginJs = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
      ecmaVersion: 2025,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn'],
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
    ignores: ['node_modules', '.vscode-test', 'out'],
  }
);
