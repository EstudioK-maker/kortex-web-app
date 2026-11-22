// eslint.config.js — apanha variáveis em falta/repetidas e outros erros antes de correres o Kortex.
// Uso:  npm i -D eslint   →   npx eslint src
const nodeGlobals = {
  require: 'readonly', module: 'writable', exports: 'writable', __dirname: 'readonly', __filename: 'readonly',
  process: 'readonly', Buffer: 'readonly', console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
  setInterval: 'readonly', clearInterval: 'readonly', setImmediate: 'readonly', URL: 'readonly', URLSearchParams: 'readonly',
  fetch: 'readonly', Response: 'readonly', AbortController: 'readonly', structuredClone: 'readonly'
};
const browserGlobals = {
  window: 'readonly', document: 'readonly', location: 'readonly', navigator: 'readonly', console: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
  requestAnimationFrame: 'readonly', fetch: 'readonly', URL: 'readonly', URLSearchParams: 'readonly',
  ResizeObserver: 'readonly', MutationObserver: 'readonly', getComputedStyle: 'readonly', confirm: 'readonly', alert: 'readonly',
  Image: 'readonly', FileReader: 'readonly', Event: 'readonly', Blob: 'readonly', atob: 'readonly', btoa: 'readonly', localStorage: 'readonly'
};
const rules = {
  'no-undef': 'error',
  'no-redeclare': 'error',
  'no-dupe-keys': 'error',
  'no-dupe-else-if': 'error',
  'no-unreachable': 'error',
  'no-const-assign': 'error',
  'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }]
};

module.exports = [
  { files: ['src/main/**/*.js', 'tools/**/*.js', 'eslint.config.js'], languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: nodeGlobals }, rules },
  { files: ['src/preload/**/*.js'], languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...nodeGlobals, ...browserGlobals } }, rules },
  { files: ['src/renderer/**/*.js'], languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: browserGlobals }, rules }
];
