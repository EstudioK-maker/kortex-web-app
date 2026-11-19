// src/main/settings.js — registo central das definições do Kortex.
// Todas as chaves vivem em SCHEMA. defineSchema() recusa chaves repetidas, por isso
// uma duplicação (como a que existia antes) rebenta logo no arranque em vez de passar despercebida.
const path = require('path');
const fs = require('fs');
const { app, nativeTheme, shell, dialog } = require('electron');
const secrets = require('./secrets');

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

const ENGINES = {
  google:     'https://www.google.com/search?q=%s',
  duckduckgo: 'https://duckduckgo.com/?q=%s',
  bing:       'https://www.bing.com/search?q=%s',
  brave:      'https://search.brave.com/search?q=%s',
  ecosia:     'https://www.ecosia.org/search?q=%s',
  perplexity: 'https://www.perplexity.ai/search?q=%s',
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const MODEL_ID = /^[\w.\-/:]+$/;

function defineSchema(entries) {
  const schema = {};
  for (const [key, def] of entries) {
    if (key in schema) throw new Error(`[Kortex Settings] chave duplicada no SCHEMA: ${key}`);
    schema[key] = def;
  }
  return schema;
}

const SCHEMA = defineSchema([
  // --- Aspeto ---
  ['appearance.theme',            { type: 'enum', values: ['dark', 'light', 'system'], default: 'dark', apply: (v) => { nativeTheme.themeSource = v; } }],
  ['appearance.accent',           { type: 'string', default: '#ff5722', validate: (v) => HEX_COLOR.test(v) }],
  ['appearance.font',             { type: 'enum', values: ['segoe', 'inter', 'system', 'mono'], default: 'segoe' }],
  ['appearance.forceDark',        { type: 'bool', default: false }],
  ['appearance.compact',          { type: 'bool', default: false }],
  ['appearance.bookmarksBar',     { type: 'bool', default: false }],
  ['appearance.showAssistantBtn', { type: 'bool', default: true }],
  ['appearance.sidebarCollapsed', { type: 'bool', default: false }],
  ['appearance.reduceMotion',     { type: 'bool', default: false }],
  ['appearance.showGreeting',     { type: 'bool', default: true }],
  ['appearance.homeBackground',   { type: 'enum', values: ['plain', 'glow'], default: 'plain' }],
  ['appearance.chatFontSize',     { type: 'enum', values: ['13', '14', '16'], default: '14' }],
  ['appearance.zoom',             { type: 'enum', values: ['0.8', '0.9', '1', '1.1', '1.25', '1.5'], default: '1' }],

  // --- Pesquisa ---
  ['search.engine', { type: 'enum', values: Object.keys(ENGINES), default: 'perplexity' }],

  // --- Privacidade ---
  ['privacy.suggestions',         { type: 'bool', default: true }],
  ['privacy.blockAds',            { type: 'bool', default: true, reloadTabs: true }],
  ['privacy.blockThirdPartyCookies', { type: 'bool', default: true, reloadTabs: true }],
  ['privacy.cookieExceptions',    { type: 'array', default: [], validate: (a) => a.every((x) => typeof x === 'string' && x.length > 0 && x.length < 256) }],
  ['privacy.dnt',                 { type: 'bool', default: false }],
  ['privacy.gpc',                 { type: 'bool', default: true }],
  ['privacy.clearOnExit',         { type: 'bool', default: false }],

  // --- Transferências ---
  ['downloads.askEach',           { type: 'bool', default: false }],
  ['downloads.showWhenDone',      { type: 'bool', default: false }],
  ['downloads.folder',            { type: 'string', default: '', validate: (v) => v === '' || (path.isAbsolute(v) && fs.existsSync(v)) }],
  ['downloads.chooseFolder',      { type: 'action', apply: async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (!r.canceled && r.filePaths[0]) await set('downloads.folder', r.filePaths[0]);
  } }],

  // --- Arranque ---
  ['startup.mode',                { type: 'enum', values: ['newtab', 'continue'], default: 'newtab' }],
  ['startup.openAtLogin',         { type: 'bool', default: false, apply: (v) => { if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: v }); } }],

  // --- Assistente IA ---
  ['assistant.enabled',           { type: 'bool', default: true }],
  ['assistant.pageAccess',        { type: 'bool', default: true }],
  // A chave NUNCA tem valor por omissão no código. Define-se em Definições → Assistente IA
  // (ou na variável de ambiente OPENROUTER_API_KEY, que o ai.js usa como alternativa).
  ['ai.apiKey',                   { type: 'string', default: '' }],
  ['ai.model',                    { type: 'string', default: 'google/gemini-3.8-flash', validate: (v) => MODEL_ID.test(v) }],
  ['ai.webSearch',                { type: 'bool', default: false }],

  // --- Plugins / sistema ---
  ['plugins',                     { type: 'object', default: {}, noReset: true, validate: (o) => Object.values(o).every((x) => typeof x === 'boolean') }],
  ['privacy.managePermissions',   { type: 'action', apply: () => app.emit('kortex:open-internal', 'kortex://permissions') }],
  ['system.openDataFolder',       { type: 'action', apply: () => shell.openPath(app.getPath('userData')) }],
]);

// Chaves cujo valor nunca vai em texto simples para o settings.json.
const SECRET_KEYS = ['ai.apiKey'];

let store = {};
let needsMigration = false;
const listeners = [];
const clone = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));

function isValid(def, v) {
  switch (def.type) {
    case 'bool':   return typeof v === 'boolean';
    case 'enum':   return def.values.includes(v);
    case 'string': return typeof v === 'string' && (!def.validate || def.validate(v));
    case 'array':  return Array.isArray(v) && (!def.validate || def.validate(v));
    case 'object': return !!v && typeof v === 'object' && !Array.isArray(v) && (!def.validate || def.validate(v));
    default:       return false;
  }
}

function load() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) store = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')) || {};
  } catch (e) {
    console.warn('[Kortex Settings] settings.json ilegível, a usar predefinições:', e.message);
    store = {};
  }
  for (const key in SCHEMA) {
    const def = SCHEMA[key];
    if (def.type === 'action') { delete store[key]; continue; }
    if (SECRET_KEYS.includes(key)) {
      const { value, wasPlain } = secrets.decrypt(store[key]);
      store[key] = value;
      if (wasPlain && value && secrets.available()) needsMigration = true; // havia um valor em texto simples: regravar cifrado
      continue;
    }
    if (!(key in store) || !isValid(def, store[key])) store[key] = clone(def.default);
  }
  for (const key of SECRET_KEYS) if (typeof store[key] !== 'string') store[key] = '';
}

function save() {
  const out = { ...store };
  for (const key of SECRET_KEYS) {
    const enc = secrets.encrypt(store[key]);
    out[key] = enc === null ? '' : enc; // sem cifra disponível, é preferível não guardar a chave a guardá-la em claro
  }
  const tmp = SETTINGS_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(out, null, 2));
  fs.renameSync(tmp, SETTINGS_PATH);
}

function init() {
  load();
  if (needsMigration) { try { save(); console.log('[Kortex Settings] chave da API migrada para armazenamento cifrado'); } catch (e) { console.warn('[Kortex Settings] migração falhou:', e.message); } }
  for (const key in SCHEMA) {
    const def = SCHEMA[key];
    if (def.apply && def.type !== 'action') {
      try { def.apply(store[key]); } catch (e) { console.warn(`[Kortex Settings] apply(${key}):`, e.message); }
    }
  }
}

const get = (key) => store[key];

function getAll() {
  const out = {};
  for (const key in SCHEMA) if (SCHEMA[key].type !== 'action') out[key] = store[key];
  out['about.version'] = app.getVersion();
  return out;
}

async function set(key, value) {
  const def = SCHEMA[key];
  if (!def) throw new Error(`Definição desconhecida: ${key}`);
  if (def.type === 'action') { await def.apply?.(); return { success: true }; }
  if (!isValid(def, value)) throw new Error(`Valor inválido para ${key}`);
  if (JSON.stringify(store[key]) === JSON.stringify(value)) return { success: true, changed: false };

  store[key] = value;
  save();
  try { def.apply?.(value); } catch (e) { console.warn(`[Kortex Settings] apply(${key}):`, e.message); }
  for (const cb of listeners) { try { cb(key, value); } catch (e) { /* um listener com erro não bloqueia os outros */ } }
  return { success: true, changed: true, restart: !!def.restart, reloadTabs: !!def.reloadTabs };
}

async function reset(prefix = '') {
  let changed = 0;
  for (const key in SCHEMA) {
    const def = SCHEMA[key];
    if (def.type === 'action' || def.noReset || !key.startsWith(prefix)) continue;
    const r = await set(key, clone(def.default));
    if (r.changed) changed++;
  }
  return { success: true, changed };
}

const onChanged = (cb) => { listeners.push(cb); };

function searchUrl(query) {
  const tpl = ENGINES[store['search.engine']] || ENGINES.google;
  return tpl.replace('%s', () => encodeURIComponent(query));
}

function resolveInput(text) {
  const t = String(text || '').trim();
  if (!t) return 'about:blank';
  if (/^(https?|file|ftp):\/\//i.test(t) || /^(about|kortex|view-source):/i.test(t)) return t;
  if (/^localhost(:\d+)?([/?#]|$)/i.test(t) || /^\d{1,3}(\.\d{1,3}){3}(:\d+)?([/?#]|$)/.test(t)) return 'http://' + t;
  if (!/\s/.test(t) && /^[^\s/?#]+\.[a-z]{2,}(:\d+)?([/?#]\S*)?$/i.test(t)) return 'https://' + t;
  return searchUrl(t);
}

module.exports = { init, get, getAll, set, reset, onChanged, searchUrl, resolveInput, SCHEMA, ENGINES };
