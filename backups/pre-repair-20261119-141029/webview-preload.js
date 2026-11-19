try { require('./chrome-spoof'); } catch (e) {}
const { contextBridge, ipcRenderer } = require('electron');

const inv = (channel, ...args) => ipcRenderer.invoke(channel, ...args);
const on = (channel, map = (d) => d) => (cb) => ipcRenderer.on(channel, (e, d) => cb(map(d)));

/* ---------------------------------------------------------------
   1) API do Kortex â€” sÃ³ para as pÃ¡ginas internas (kortex://...)
   --------------------------------------------------------------- */
if (location.protocol === 'kortex:') {
  // DisponÃ­vel em window.kortex e em window.kortexSettings (a loja usa ambos).
  const webstore = {
    installFromWebStore: (id) => inv('webstore:install', id),
    getWebStoreIcon: (id) => inv('webstore:get-icon', id),
    searchWebStore: (query) => inv('webstore:search', query)
  };

  contextBridge.exposeInMainWorld('kortex', {
    ...webstore,
    getConfig: () => inv('get-config'),
    updateProfile: (data) => inv('profile:update', data),
    onProfileUpdated: on('profile-updated'),
    setupSave: (data) => inv('setup:save', data),
    setBackground: (url) => inv('background:set', url),
    autofill: { list: () => inv('autofill:list'), delete: (domain) => inv('autofill:delete', domain) },
    clearData: { getStats: () => inv('clear-data:stats'), execute: (opts) => inv('clear-data:execute', opts) },
    window: {
      minimize: () => ipcRenderer.send('window:minimize'),
      maximize: () => ipcRenderer.send('window:maximize'),
      close: () => ipcRenderer.send('window:close')
    },
    tabs: {
      create: (url) => inv('tabs:create', url),
      openInternal: (url) => inv('tabs:open-internal', url),
      createPrivate: () => inv('tabs:create-private'),
      close: (id) => inv('tabs:close', id),
      activate: (id) => inv('tabs:activate', id),
      navigate: (id, url) => inv('tab:navigate', id, url),
      back: () => inv('tab:back'),
      forward: () => inv('tab:forward'),
      reload: () => inv('tab:reload'),
      onListUpdated: on('tabs:updated-list'),
      onShowHome: on('show-home')
    },
    layout: { setPageBounds: (bounds) => ipcRenderer.send('layout:page-bounds', bounds) },
    extensions: {
      loadUnpacked: () => inv('ext:load-unpacked'),
      list: () => inv('ext:list'),
      remove: (id, p) => inv('ext:remove', id, p),
      reload: (id, p) => inv('ext:reload', id, p),
      toggle: (id, p, enable) => inv('ext:toggle', id, p, enable),
      getDetails: (id, p) => inv('ext:get-details', id, p),
      readCode: (p) => inv('ext:read-code', p)
    },
    extensionsPopup: {
      show: (params) => ipcRenderer.send('extensions-popup:show', params),
      manage: () => ipcRenderer.send('extensions-popup:manage'),
      clickExt: (id) => ipcRenderer.send('extensions-popup:click-ext', id),
      onState: on('extensions-popup:state')
    },
    menu: {
      open: (name, x, y) => ipcRenderer.send('menu:open', { name, x, y }),
      close: () => ipcRenderer.send('menu:close'),
      action: (action) => ipcRenderer.send('menu:action', action),
      onState: on('menu:state'),
      onClosed: (cb) => ipcRenderer.on('menu:closed', () => cb())
    },
    chat: (payload) => inv('chat', payload),
    ai: { onChunk: on('ai-chunk'), onError: on('ai-error'), onDone: on('ai-done') },
    getSuggestions: (query) => inv('get-suggestions', query),
    history: {
      getTopSites: () => inv('history:getTopSites'),
      get: () => inv('history:get'),
      remove: (url) => inv('history:remove', url),
      clear: () => inv('history:clear'),
      onUpdated: (cb) => ipcRenderer.on('history:updated', () => cb())
    },
    bookmarks: { list: () => inv('bookmarks:list'), remove: (id) => inv('bookmarks:remove', id), setFolder: (id, folder) => inv('bookmarks:setFolder', id, folder) },
    permissions: { list: () => inv('permissions:list'), remove: (key) => inv('permissions:remove', key), clear: () => inv('permissions:clear') },
    security: { proceed: (url) => inv('security:proceed', url) },
    downloads: {
      list: () => inv('downloads:list'),
      open: (id) => inv('downloads:open', id),
      show: (id) => inv('downloads:show', id),
      pause: (id) => inv('downloads:pause', id),
      resume: (id) => inv('downloads:resume', id),
      cancel: (id) => inv('downloads:cancel', id),
      clear: () => inv('downloads:clear')
    },
    plugins: { get: () => inv('plugins:get'), toggle: (id, v) => inv('plugins:toggle', id, v) }
  });

  contextBridge.exposeInMainWorld('kortexSettings', {
    ...webstore,
    reset: (prefix) => inv('settings:reset', prefix),
    get: (key) => inv('settings:get', key),
    getAll: () => inv('settings:getAll'),
    set: (key, value) => inv('settings:set', key, value),
    onChanged: on('settings:changed')
  });
}

/* ---------------------------------------------------------------
   2) Autofill: deteÃ§Ã£o de logins em qualquer site
   --------------------------------------------------------------- */
function checkForLogin() {
  const passInput = document.querySelector('input[type="password"]');
  if (!passInput || !passInput.value) return;
  const userInput = document.querySelector('input[type="email"]') || document.querySelector('input[type="text"]');
  const username = userInput ? userInput.value : '';
  if (username) ipcRenderer.send('autofill:prompt-save', { domain: window.location.hostname, username, password: passInput.value });
}

window.addEventListener('DOMContentLoaded', () => {
  const domain = window.location.hostname;
  if (domain) {
    inv('autofill:get', domain).then((saved) => {
      if (!saved) return;
      const userInput = document.querySelector('input[type="email"]') || document.querySelector('input[type="text"]');
      const passInput = document.querySelector('input[type="password"]');
      if (userInput && saved.username) userInput.value = saved.username;
      if (passInput && saved.password) passInput.value = saved.password;
    }).catch(() => { /* sem dados guardados */ });
  }
  document.addEventListener('submit', () => setTimeout(checkForLogin, 100));
  document.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') {
      const text = (e.target.innerText || e.target.value || '').toLowerCase();
      if (text.includes('login') || text.includes('entrar') || text.includes('sign in') || text.includes('submit')) setTimeout(checkForLogin, 500);
    }
  });
});

/* ---------------------------------------------------------------
   3) Esconde banners de "transferir o Chrome" e avisos de browser antigo.
      Este CSS Ã© injetado em sites de terceiros, que tÃªm as suas prÃ³prias regras:
      aqui o !important Ã© a ferramenta certa (nÃ£o afeta a UI do Kortex).
   --------------------------------------------------------------- */
window.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
    #gb, .gb_Jd, .gb_Kd, .gb_Ld, .promo-banner, .browser-promo { display: none !important; }
    .unsupported-browser-banner, #unsupported-browser { display: none !important; }
  `;
  document.head.appendChild(style);
});

