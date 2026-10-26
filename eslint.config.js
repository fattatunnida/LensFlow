const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/**', 'test-results/**', 'docs/**', '.firebase/**', 'backend/functions/node_modules/**'] },
]);
