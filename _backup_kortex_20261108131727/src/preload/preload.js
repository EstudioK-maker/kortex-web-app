const { contextBridge, ipcRenderer } = require('electron');
const inv = (ch, ...a) => ipcRenderer.invoke(ch, ...a);
const ALLOWED_EVENTS = new Set([
  'toast', 'focus-url', 'find:open', 'find:close', 'find:result',
  'bookmarks:changed', 'bookmarks:toggle-bar', 'assistant:toggle', 'assistant:ask', 'downloads:updated'
]);

contextBridge.exposeInMainWorld('kortex', {
  log: (msg) => ipcRenderer.send('log', msg),
  on: (channel, cb) => { if (ALLOWED_EVENTS.has(channel)) ipcRenderer.on(channel, (e, d) => cb(d)); },
  window: { minimize: () => ipcRenderer.send('window:minimize'), maximize: () => ipcRenderer.send('window:maximize'), close: () => ipcRenderer.send('window:close') },
  tabs: {
    create: (url) => inv('tabs:create', url),
    createPrivate: () => inv('tabs:create-private'),
    close: (id) => inv('tabs:close', id),
    activate: (id) => inv('tabs:activate', id),
    navigate: (id, url) => inv('tab:navigate', id, url),
    back: () => inv('tab:back'), forward: () => inv('tab:forward'), reload: () => inv('tab:reload'),
    context: (id) => ipcRenderer.send('tabs:context', id),
    onListUpdated: (cb) => ipcRenderer.on('tabs:updated-list', (e, data) => cb(data)),
    onShowHome: (cb) => ipcRenderer.on('show-home', (e, show) => cb(show))
  },
  layout: { setPageBounds: (bounds) => ipcRenderer.send('layout:page-bounds', bounds) },
  extensions: {
    loadUnpacked: () => inv('ext:load-unpacked'), list: () => inv('ext:list'),
    remove: (id, p) => inv('ext:remove', id, p), reload: (id, p) => inv('ext:reload', id, p),
    toggle: (id, p, enable) => inv('ext:toggle', id, p, enable),
    getDetails: (id, p) => inv('ext:get-details', id, p), readCode: (p) => inv('ext:read-code', p)
  },
  extensionsPopup: {
    show: (params) => ipcRenderer.send('extensions-popup:show', params),
    manage: () => ipcRenderer.send('extensions-popup:manage'),
    clickExt: (id) => ipcRenderer.send('extensions-popup:click-ext', id),
    onState: (cb) => ipcRenderer.on('extensions-popup:state', (e, data) => cb(data))
  },
  menu: {
    open: (name, x, y) => ipcRenderer.send('menu:open', { name, x, y }),
    close: () => ipcRenderer.send('menu:close'),
    action: (action) => ipcRenderer.send('menu:action', action),
    onState: (cb) => ipcRenderer.on('menu:state', (e, state) => cb(state)),
    onClosed: (cb) => ipcRenderer.on('menu:closed', () => cb())
  },
  contextMenu: {
    action: (action, params) => ipcRenderer.send('context-menu:action', action, params),
    onState: (cb) => ipcRenderer.on('context-menu:open', (e, state) => cb(state))
  },
  getConfig: () => inv('get-config'),
  updateProfile: (data) => inv('profile:update', data),
  onProfileUpdated: (cb) => ipcRenderer.on('profile-updated', (e, data) => cb(data)),
  setupSave: (data) => inv('setup:save', data),
  setBackground: (url) => inv('background:set', url),
  autofill: { list: () => inv('autofill:list'), delete: (domain) => inv('autofill:delete', domain) },
  clearData: { getStats: () => inv('clear-data:stats'), execute: (opts) => inv('clear-data:execute', opts) },
  chat: (payload) => inv('chat', payload),
  ai: {
    onChunk: (cb) => ipcRenderer.on('ai-chunk', (e, d) => cb(d)),
    onError: (cb) => ipcRenderer.on('ai-error', (e, d) => cb(d)),
    onDone: (cb) => ipcRenderer.on('ai-done', (e, d) => cb(d)),
    stop: (chatId) => ipcRenderer.send('ai:stop', chatId)
  },
  getSuggestions: (query) => inv('get-suggestions', query),
  omnibox: { go: (text) => inv('omnibox:go', text) },
  history: {
    getTopSites: () => inv('history:getTopSites'), get: () => inv('history:get'),
    remove: (url) => inv('history:remove', url), clear: () => inv('history:clear'),
    onUpdated: (cb) => ipcRenderer.on('history:updated', () => cb())
  },
  bookmarks: {
    list: () => inv('bookmarks:list'), isBookmarked: (url) => inv('bookmarks:is', url),
    toggle: (b) => inv('bookmarks:toggle', b), remove: (id) => inv('bookmarks:remove', id)
  },
  downloads: {
    list: () => inv('downloads:list'), open: (id) => inv('downloads:open', id),
    show: (id) => inv('downloads:show', id), cancel: (id) => inv('downloads:cancel', id),
    clear: () => inv('downloads:clear')
  },
  find: {
    start: (text, opts = {}) => ipcRenderer.send('find:start', { text, ...opts }),
    stop: () => ipcRenderer.send('find:stop')
  },
  plugins: { get: () => inv('plugins:get'), toggle: (id, v) => inv('plugins:toggle', id, v) }
});

contextBridge.exposeInMainWorld('kortexSettings', {
  get: (key) => inv('settings:get', key),
  set: (key, val) => inv('settings:set', key, val),
  getAll: () => inv('settings:getAll'),
  reset: (prefix) => inv('settings:reset', prefix),
  onChanged: (cb) => ipcRenderer.on('settings:changed', (e, data) => cb(data))
});