module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2025,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn'],
    '@typescript-eslint/explicit-function-return-type': 'off',
  },
  env: {
    browser: true,
    node: true,
  },
};
