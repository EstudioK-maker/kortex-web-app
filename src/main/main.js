
async function ensureWidevineReady() {
  try {
    await components.whenReady(components.WIDEVINE_CDM_ID);
    console.log('[Kortex] Widevine CDM pronto:', JSON.stringify(components.status()));
  } catch (err) {
    console.error('[Kortex] Falha a preparar Widevine:', err);
  }
}

﻿const { app, BaseWindow, WebContentsView, ipcMain, session, protocol, BrowserWindow, dialog, shell, components } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { ElectronChromeExtensions } = require('electron-chrome-extensions');
const settings = require('./settings');

const secrets = require('./secrets');
const extMenu = require('./extensions-menu');
const features = require('./features');
const pro = require('./browser-features');
const ai = require('./ai');
const AdmZip = require('adm-zip');
const { autoUpdater } = require('electron-updater');
const { urlFromArgv } = require('./default-browser');

const RENDERER_DIR = path.join(__dirname, '../renderer');
const PAGES_DIR = path.join(RENDERER_DIR, 'pages');
const PRELOAD = path.join(__dirname, '../preload/preload.js');
const WEBVIEW_PRELOAD = path.join(__dirname, '../preload/webview-preload.js');
const googleCompat = require('./google-compat');
const webstoreInstall = require('./webstore-install');
const USER_AGENT = googleCompat.UA;

protocol.registerSchemesAsPrivileged([{ scheme: 'kortex', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.setName('Kortex');

// Limpa o User-Agent global para não expor o token "Electron" (Google bloqueia)
app.userAgentFallback = app.userAgentFallback.replace('Electron/' + process.versions.electron, '');
app.userAgentFallback = app.userAgentFallback.replace('Chrome/' + process.versions.chrome, 'Chrome');
app.userAgentFallback = USER_AGENT;

const historyPath = path.join(app.getPath('userData'), 'history.json');
const configPath = path.join(app.getPath('userData'), 'kortex-config.json');
let mainWindow, chromeView, overlayView, suggestView, extMenuView, ext;
const pageViews = {};
let activeTabId = null;
let tabCounter = 0;
let pageBounds = null; // últimos limites da área de página enviados pela UI (ver applyBounds)

/* ---------------- Extensões guardadas ---------------- */
let savedExtensions = [];
const extensionsJsonPath = path.join(app.getPath('userData'), 'extensions.json');
try { if (fs.existsSync(extensionsJsonPath)) savedExtensions = JSON.parse(fs.readFileSync(extensionsJsonPath, 'utf8')); } catch (e) { /* ficheiro corrompido: começa vazio */ }

let disabledExtensions = [];
const disabledExtPath = path.join(app.getPath('userData'), 'disabledExtensions.json');
try { if (fs.existsSync(disabledExtPath)) disabledExtensions = JSON.parse(fs.readFileSync(disabledExtPath, 'utf8')); } catch (e) { /* idem */ }

const normalizePath = (p) => { try { return path.normalize(p).toLowerCase(); } catch (e) { return String(p).toLowerCase(); } };
const nav = (wc) => wc.navigationHistory || wc;

/* ---------------- Atualizações ---------------- */
function setupAutoUpdater() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', () => {
    const win = new BrowserWindow({ width: 380, height: 260, frame: false, resizable: false, alwaysOnTop: true, center: true, backgroundColor: '#0f1011', webPreferences: { nodeIntegration: true, contextIsolation: false } });
    try { win.loadFile(path.join(RENDERER_DIR, 'update.html')); } catch (e) { /* sem janela de progresso */ }
    autoUpdater.downloadUpdate();
  });
  autoUpdater.on('download-progress', (p) => { BrowserWindow.getAllWindows().forEach((w) => { if (!w.webContents.isDestroyed()) w.webContents.send('update-progress', p.percent); }); });
  autoUpdater.on('update-downloaded', () => autoUpdater.quitAndInstall(true, true));
  autoUpdater.checkForUpdates();
}

/* ---------------- Protocolo kortex:// ----------------
   Um único sítio decide que ficheiro serve cada endereço interno:
   kortex://<anfitrião>/  → página; kortex://<anfitrião>/<ficheiro> → recurso da pasta pages/. */
const KORTEX_PAGES = {
  settings: 'settings.html',
  extensions: 'extensions.html',
  store: 'store.html',
  plugins: 'plugins.html',
  history: 'library.html',
  bookmarks: 'library.html',
  downloads: 'library.html',
  permissions: 'permissions.html',
  certerror: 'certerror.html'
};
const KORTEX_TITLES = {
  store: 'Loja do Kortex', extensions: 'Extensões', settings: 'Definições', plugins: 'Plugins',
  history: 'Histórico', bookmarks: 'Marcadores', downloads: 'Transferências',
  permissions: 'Permissões dos sites', certerror: 'Ligação não privada'
};
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

function handleKortexRequest(request) {
  
  const notFound = () => new Response('Not found', { status: 404 });
  let url, rel;
  try { url = new URL(request.url); rel = decodeURIComponent(url.pathname).replace(/^\/+/, ''); } catch (e) { return notFound(); }
  const page = KORTEX_PAGES[url.hostname];
  if (!page) return notFound();
  if (!rel) rel = page;
  const filePath = path.resolve(PAGES_DIR, rel);
  if (!filePath.startsWith(PAGES_DIR + path.sep) || !fs.existsSync(filePath)) return notFound();

  return new Response(fs.readFileSync(filePath), { headers: { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-store' } });
}

const internalTitle = (url) => { try { return KORTEX_TITLES[new URL(url).hostname] || 'Kortex'; } catch (e) { return 'Kortex'; } };

/* ---------------- Janela ---------------- */
function createWindow() {
  mainWindow = new BaseWindow({ width: 1400, height: 900, frame: false, titleBarStyle: 'hidden', backgroundColor: '#0f1011' });

  chromeView = new WebContentsView({ webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: false } });
  chromeView.setBackgroundColor('#00000000');
  mainWindow.contentView.addChildView(chromeView);
  pro.attach(chromeView.webContents);
  chromeView.setBounds({ x: 0, y: 0, width: 1400, height: 900 });
  chromeView.webContents.loadFile(path.join(RENDERER_DIR, fs.existsSync(configPath) ? 'index.html' : 'setup.html'));

  // Menus da aplicação (overlay) e sugestões da barra de endereço ficam por cima das páginas.
  overlayView = new WebContentsView({ webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: false } });
  overlayView.setBackgroundColor('#00000000');
  overlayView.setVisible(false);
  overlayView.webContents.loadFile(path.join(RENDERER_DIR, 'overlay.html'));

  suggestView = new WebContentsView({ webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: false } });
  suggestView.setBackgroundColor('#00000000');
  suggestView.setVisible(false);
  suggestView.webContents.loadFile(path.join(RENDERER_DIR, 'suggestions.html'));

  // Popup do botão de extensões (lista + menu de cada extensão)
  extMenuView = extMenu.create({
    getMainWindow: () => mainWindow,
    getChromeView: () => chromeView,
    raise: () => raiseOverlays(),
    isDisabled: (p) => disabledExtensions.some((d) => normalizePath(d) === normalizePath(p)),
    navigateActive: (url) => navigateActive(url),
    toast: (msg) => { if (chromeView && !chromeView.webContents.isDestroyed()) chromeView.webContents.send('toast', msg); }
  }, PRELOAD, path.join(RENDERER_DIR, 'extensions-menu.html'));

  raiseOverlays();
  fitOverlaysToWindow();

  let startupDone = false;
  chromeView.webContents.on('did-finish-load', () => {
    if (startupDone || !fs.existsSync(configPath)) return;
    startupDone = true;
    const urls = settings.get('startup.mode') === 'continue' ? features.readSessionTabs() : [];
    const startupUrl = urlFromArgv(process.argv);
      restorePinnedTabs(); if (startupUrl) createNewTab(startupUrl);
      else if (urls.length) urls.forEach((u) => createNewTab(u)); else createNewTab();
  });
  mainWindow.on('close', () => features.saveSessionTabs(() => pageViews));

  const handleResize = () => { fitOverlaysToWindow(); hideSuggestions(); extMenu.hide(); };
  mainWindow.on('resize', handleResize);
  mainWindow.on('maximize', () => setTimeout(handleResize, 50));
  mainWindow.on('unmaximize', () => setTimeout(handleResize, 50));
  mainWindow.on('restore', () => setTimeout(handleResize, 50));
}

function fitOverlaysToWindow() {
  if (!mainWindow) return;
  const { width, height } = mainWindow.getContentBounds();
  chromeView.setBounds({ x: 0, y: 0, width, height });
  overlayView.setBounds({ x: 0, y: 0, width, height });
}

// Voltar a adicionar um filho move-o para o topo: as sugestões ficam sempre acima das páginas, e o overlay acima de tudo.
function raiseOverlays() {
  mainWindow.contentView.addChildView(suggestView);
  mainWindow.contentView.addChildView(extMenuView);
  mainWindow.contentView.addChildView(overlayView);
}

/* ---------------- Arranque ---------------- */
app.whenReady().then(async () => {
  
  await ensureWidevineReady();
  settings.init();
  migrateAutofill();
  protocol.handle('kortex', handleKortexRequest);
  session.defaultSession.setUserAgent(USER_AGENT);
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    googleCompat.fixRequestHeaders(details, details.requestHeaders);
    callback({ requestHeaders: details.requestHeaders });
  });

  const adDomains = ['*://*.doubleclick.net/*', '*://*.google-analytics.com/*', '*://*.googlesyndication.com/*', '*://*.adservice.google.com/*', '*://*.facebook.com/tr*', '*://*.scorecardresearch.com/*', '*://*.adnxs.com/*', '*://*.quantserve.com/*', '*://*.outbrain.com/*', '*://*.taboola.com/*', '*://*.criteo.com/*', '*://*.criteo.net/*', '*://*.adroll.com/*', '*://*.amazon-adsystem.com/*', '*://*.pubmatic.com/*', '*://*.rubiconproject.com/*', '*://*.openx.net/*', '*://*.adsrvr.org/*'];
  session.defaultSession.webRequest.onBeforeRequest({ urls: adDomains }, (details, callback) => {
    callback({ cancel: settings.get('privacy.blockAds') !== false });
  });

  ext = new ElectronChromeExtensions({ session: session.defaultSession });
  if (!app.isPackaged) logExtensionWorkers(session.defaultSession);
  for (const extPath of savedExtensions) {
    if (!disabledExtensions.some((p) => normalizePath(p) === normalizePath(extPath))) {
      try { await session.defaultSession.extensions.loadExtension(extPath); console.log(`[Kortex] Extensão carregada: ${extPath}`); }
      catch (e) { console.error(`[Kortex] Erro ao carregar ${extPath}:`, e.message); }
    }
  }

  features.init({ getViews: () => pageViews });
  pro.init({
    settings,
    getMainWindow: () => mainWindow, getChromeView: () => chromeView,
    getViews: () => pageViews, getActiveId: () => activeTabId,
    createNewTab: (u, p) => createNewTab(u, p), closeTab: (id) => closeTab(id), switchTab: (id) => switchTab(id),
    sendTabsToUI: () => sendTabsToUI(), historyPath
  });
  ai.init({
    settings,
    getActiveView: () => pageViews[activeTabId],
    getAllViews: () => pageViews,
    getSkillsPrompt: () => aplicarSkills(null, null, activeTabId, pageViews)
  });

  createWindow();
  require('./updater').init({ getWindow: () => require('electron').BrowserWindow.getAllWindows().find(w => !w.isDestroyed()) });
});

app.on('kortex:open-internal', (url) => { if (/^kortex:\/\//i.test(url)) pro.openInternal(url); });

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      const url = urlFromArgv(commandLine);
      if (url) {
        if (typeof createNewTab === 'function') createNewTab(url);
      }
    }
  });
}

// --- LOGIN GOOGLE: Janela separada com User-Agent de Firefox ---
const { BrowserWindow: BW } = require('electron');
const googleLoginUA = googleCompat.UA;

function openGoogleLogin(url) {
  const loginWin = new BW({
    width: 500, height: 700, title: 'Login Google', autoHideMenuBar: true,
    webPreferences: { session: session.defaultSession, nodeIntegration: false, contextIsolation: true, sandbox: true, userAgent: googleLoginUA }
  });
  loginWin.loadURL(url);
  loginWin.webContents.on('did-navigate', (e, newUrl) => {
    if (newUrl.startsWith('https://myaccount.google.com') || newUrl.startsWith('https://accounts.google.com/ServiceLogin')) return;
    if (newUrl.startsWith('https://www.google.com') || newUrl.startsWith('https://accounts.google.com')) return;
    if (!newUrl.includes('accounts.google.com') && !newUrl.includes('google.com')) {
      loginWin.close();
    }
  });
  return loginWin;
}
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// Em desenvolvimento, mostra na consola o erro real dos service workers das extensões
// (o Electron só diz "Service worker registration failed. Status code: 2").
function logExtensionWorkers(ses) {
  try {
    ses.serviceWorkers.on('console-message', (_e, d) => console.log('[Kortex][SW]', d.message, d.sourceUrl ? `(${d.sourceUrl}:${d.lineNumber})` : ''));
    ses.serviceWorkers.on('registration-completed', (_e, d) => console.log('[Kortex][SW] registado:', d.scope));
  } catch (e) { /* API indisponível nesta versão */ }
}

/* ---------------- Definições e perfil ---------------- */

ipcMain.handle('app:isDefaultBrowser', () => {
  return app.isDefaultProtocolClient('http') && app.isDefaultProtocolClient('https');
});

ipcMain.handle('app:setDefaultBrowser', () => {
  app.setAsDefaultProtocolClient('http');
  app.setAsDefaultProtocolClient('https');
  return true;
});

ipcMain.handle('settings:get', (e, key) => settings.get(key));
ipcMain.handle('settings:getAll', () => settings.getAll());
ipcMain.handle('settings:set', async (e, key, val) => { try { return await settings.set(key, val); } catch (err) { return { success: false, error: err.message }; } });
ipcMain.handle('settings:reset', async (e, prefix) => { try { return await settings.reset(typeof prefix === 'string' ? prefix : ''); } catch (err) { return { success: false, error: err.message }; } });
ipcMain.handle('plugins:get', () => settings.get('plugins') || {});
ipcMain.handle('plugins:toggle', (e, id, val) => { const p = settings.get('plugins') || {}; p[id] = !!val; return settings.set('plugins', p); });

ipcMain.handle('get-config', () => {
  if (fs.existsSync(configPath)) { try { return JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) { return { name: 'Utilizador' }; } }
  return { name: 'Utilizador' };
});
ipcMain.handle('profile:update', (e, data) => {
  let c = {};
  if (fs.existsSync(configPath)) c = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  c.name = data.name; c.username = data.username; c.avatar = data.avatar;
  fs.writeFileSync(configPath, JSON.stringify(c));
  chromeView.webContents.send('profile-updated', c);
  return { success: true };
});
// O primeiro separador é criado pelo listener 'did-finish-load' de createWindow (um só sítio).
ipcMain.handle('setup:save', (e, data) => {
  fs.writeFileSync(configPath, JSON.stringify(data));
  chromeView.webContents.loadFile(path.join(RENDERER_DIR, 'index.html'));
  return true;
});

/* ---------------- Separadores ---------------- */
const pinnedTabsPath = path.join(app.getPath('userData'), 'pinned-tabs.json');
let pinnedReady = false;
let pinnedLast = '';
function savePinnedTabs() {
  if (!pinnedReady) return;
  try {
    const urls = Object.keys(pageViews)
      .filter((k) => pageViews[k].kortexPinned && !pageViews[k].isPrivate)
      .map((k) => pageViews[k].webContents.getURL())
      .filter((u) => /^(https?:|kortex:)/i.test(u) && u.length < 2000 && !/^https?:\/\/accounts\.google\.com\//i.test(u));
    const s = JSON.stringify(urls); console.log('[pinned] guardar:', Object.keys(pageViews).filter((k) => pageViews[k].kortexPinned).length, 'fixadas ->', urls.length, 'validas |', Object.keys(pageViews).filter((k) => pageViews[k].kortexPinned).map((k) => pageViews[k].webContents.getURL().slice(0, 80)).join(' ; '));
    if (s !== pinnedLast) { pinnedLast = s; fs.writeFileSync(pinnedTabsPath, s, 'utf8'); }
  } catch (e) { console.log('[pinned] erro ao guardar:', e && e.message); }
}
function restorePinnedTabs() {
  try {
    if (fs.existsSync(pinnedTabsPath)) {
      const urls = JSON.parse(fs.readFileSync(pinnedTabsPath, 'utf8'));
      pinnedLast = JSON.stringify(urls);
      (Array.isArray(urls) ? urls : []).forEach((u) => {
        if (typeof u !== 'string' || !/^(https?:|kortex:)/i.test(u)) return;
        const id = createNewTab(u);
        if (pageViews[id]) pageViews[id].kortexPinned = true;
      });
    }
  } catch (e) { console.log('[pinned] erro ao restaurar:', e && e.message); }
  pinnedReady = true;
  sendTabsToUI();
}

function sendTabsToUI() {
  const list = Object.keys(pageViews).map((id) => {
    const view = pageViews[id];
    const url = view.webContents.getURL();
    let title = (view.webContents.getTitle() || '').trim();
    if (url.startsWith('kortex://')) {
      title = internalTitle(url);
    } else if (url === 'about:blank' || url === '') {
      title = view.isPrivate ? 'Navegação Privada' : 'Novo separador';
    } else if (!title || title === 'K' || title === 'Kortex') {
      try { title = new URL(url).hostname.replace('www.', ''); } catch (e) { title = 'A carregar...'; }
    }
    const info = pro.tabInfo(id, { id, title, url, isPrivate: view.isPrivate || false }); if (view.kortexPinned) info.pinned = true; return info;
  });
  list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)); savePinnedTabs();
  if (chromeView && !chromeView.webContents.isDestroyed()) chromeView.webContents.send('tabs:updated-list', { tabs: list, activeId: activeTabId });
}

function updateTabVisibility() {
  const view = pageViews[activeTabId];
  if (!view) return;
  const url = view.webContents.getURL();
  const isHome = url === 'about:blank' || url === '';
  view.setVisible(!isHome);
  chromeView.webContents.send('show-home', isHome);
}

// Uma WebContentsView nova tem limites 0×0. Aplicamos sempre os últimos limites conhecidos da área de página,
// senão um separador criado depois do arranque (ex.: Transferências, Ctrl+T) abre mas fica invisível.
function applyBounds(view) {
  if (view && pageBounds) view.setBounds(pageBounds);
}

function createNewTab(url = 'about:blank', isPrivate = false, opts = {}) {
  tabCounter++;
  const id = 'tab-' + tabCounter;
  let tabSession = opts.webContents ? opts.webContents.session : session.defaultSession;
  if (isPrivate && !opts.webContents) {
    tabSession = session.fromPartition('private-' + Date.now(), { cache: false });
    googleCompat.applySession(tabSession, true);
    tabSession.protocol.handle('kortex', handleKortexRequest);
  }

  const view = new WebContentsView(opts.webContents ? { webContents: opts.webContents } : { webPreferences: { session: tabSession, preload: WEBVIEW_PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: false } });
  mainWindow.contentView.addChildView(view);
  raiseOverlays();

  pageViews[id] = view;
  view.isPrivate = isPrivate;
  view.setBackgroundColor('#00000000');
  applyBounds(view);
  if (!opts.noLoad) view.webContents.loadURL(url).catch(() => { /* falhas de carregamento tratadas em browser-features (página de erro) */ });

  pro.attachView(id, view); try { webstoreInstall.attachView(view); } catch (e) { console.log('[webstore] attachView:', e && e.message); }
  if (isPrivate && !opts.webContents) pro.setupSession(tabSession);
  view.webContents.on('dom-ready', () => features.applyZoom(view.webContents));

  
  view.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:/i.test(target) || target === 'about:blank' || target === '') {
      return { action: 'allow', createWindow: (options) => { const nid = createNewTab('about:blank', !!view.isPrivate, { noLoad: true, webContents: options.webContents }); return pageViews[nid].webContents; } };
    }
    if (!/^(javascript|data|file|blob):/i.test(target)) shell.openExternal(target);
    return { action: 'deny' };
  });
  view.webContents.once('destroyed', () => {
    if (pageViews[id] !== view) return;
    try { pro.onClose(view); } catch (e) {}
    try { if (ext && !view.isPrivate) ext.removeTab(view.webContents); } catch (e) {}
    try { mainWindow.contentView.removeChildView(view); } catch (e) {}
    delete pageViews[id];
    if (activeTabId === id) { const rest = Object.keys(pageViews); if (rest.length > 0) switchTab(rest[rest.length - 1]); else createNewTab(); }
    sendTabsToUI();
  });


  view.webContents.on('page-title-updated', () => sendTabsToUI());
  view.webContents.on('did-navigate', () => { updateTabVisibility(); sendTabsToUI(); saveToHistory(view.webContents.getTitle(), view.webContents.getURL()); });
  view.webContents.on('did-finish-load', () => { view.webContents.invalidate(); });

  if (ext && !isPrivate) ext.addTab(view.webContents, mainWindow);
  switchTab(id);
  return id;
}

function switchTab(id) {
  hideSuggestions();
  extMenu.hide();
  if (activeTabId && pageViews[activeTabId]) pageViews[activeTabId].setVisible(false);
  activeTabId = id;
  if (pageViews[id]) { applyBounds(pageViews[id]); updateTabVisibility(); const u = pageViews[id].webContents.getURL(); if (u === 'about:blank' || u === '') chromeView.webContents.focus(); else pageViews[id].webContents.focus(); }
  sendTabsToUI();
}

function closeTab(id) {
  if (pageViews[id]) {
    pro.onClose(pageViews[id]);
    if (ext && !pageViews[id].isPrivate) ext.removeTab(pageViews[id].webContents);
    mainWindow.contentView.removeChildView(pageViews[id]);
    pageViews[id].webContents.close();
    delete pageViews[id];
  }
  if (activeTabId === id) {
    const rest = Object.keys(pageViews);
    if (rest.length > 0) switchTab(rest[rest.length - 1]); else createNewTab();
  }
  sendTabsToUI();
}

// Navega o separador ativo para um endereço interno ou da barra.
function navigateActive(url) {
  const view = pageViews[activeTabId];
  if (!view) return;
  view.webContents.loadURL(url).catch(() => { /* ver createNewTab */ });
  updateTabVisibility();
}

try { webstoreInstall.init({}); } catch (e) { console.log('[webstore] init:', e && e.message); }
ipcMain.handle('tabs:create', (e, url) => createNewTab(url || 'about:blank'));
ipcMain.handle('tabs:create-private', () => createNewTab('about:blank', true));
ipcMain.handle('tabs:close', (e, id) => { closeTab(id); return true; });
ipcMain.handle('tabs:activate', (e, id) => { switchTab(id); return true; });

ipcMain.on('tabs:context', (e, id) => {
  try {
    const { Menu, clipboard } = require('electron');
    const view = pageViews[id];
    const wc = view && view.webContents && !view.webContents.isDestroyed() ? view.webContents : null;
    const url = wc ? wc.getURL() : '';
    const keys = Object.keys(pageViews);
    const ordered = keys.filter((k) => pageViews[k].kortexPinned).concat(keys.filter((k) => !pageViews[k].kortexPinned));
    const idx = ordered.indexOf(id);
    const right = idx > -1 ? ordered.slice(idx + 1) : [];
    const pinned = !!(view && view.kortexPinned);
    const muted = !!(wc && wc.isAudioMuted());
    const isHttp = /^(https?:|kortex:)/i.test(url);
    Menu.buildFromTemplate([
      { label: pinned ? 'Desafixar separador' : 'Fixar separador', enabled: !!view, click: () => { view.kortexPinned = !pinned; sendTabsToUI(); } },
      { label: 'Adicionar/remover dos favoritos', enabled: isHttp, click: () => { try { pro.toggleBookmark(url, wc.getTitle()); } catch (x) { console.log('[tabs:context] favoritos:', x && x.message); } } },
      { type: 'separator' },
      { label: 'Copiar ligação', enabled: !!url && url !== 'about:blank', click: () => clipboard.writeText(url) },
      { type: 'separator' },
      { label: 'Recarregar', accelerator: 'CmdOrCtrl+R', enabled: !!wc, click: () => { try { wc.reload(); } catch (x) {} } },
      { label: 'Duplicar', enabled: !!url, click: () => createNewTab(url, !!(view && view.isPrivate)) },
      { label: muted ? 'Reativar som do site' : 'Silenciar som do site', enabled: !!wc, click: () => { try { wc.setAudioMuted(!muted); sendTabsToUI(); } catch (x) {} } },
      { type: 'separator' },
      { label: 'Fechar', accelerator: 'CmdOrCtrl+W', click: () => closeTab(id) },
      { label: 'Fechar os outros separadores', enabled: keys.length > 1, click: () => { keys.filter((k) => k !== id).forEach((k) => { try { closeTab(k); } catch (x) {} }); } },
      { label: 'Fechar separadores à direita', enabled: right.length > 0, click: () => { right.forEach((k) => { try { closeTab(k); } catch (x) {} }); } }
    ]).popup();
  } catch (err) { console.log('[tabs:context] erro:', err && err.message); }
});
// Abre um endereço kortex:// reaproveitando o separador atual se estiver em branco (mesma regra do Ctrl+H / Ctrl+J).
ipcMain.handle('tabs:open-internal', (e, url) => {
  if (typeof url !== 'string' || !/^kortex:\/\//i.test(url)) return false;
  pro.openInternal(url);
  return true;
});
// Reordenar: reconstrói pageViews pela ordem recebida. Tudo o resto (Ctrl+1..9, Ctrl+Tab, "fechar à direita")
// usa a ordem das chaves deste objeto, por isso fica coerente com o que se vê.
ipcMain.handle('tabs:reorder', (e, ids) => {
  if (!Array.isArray(ids)) return false;
  const known = Object.keys(pageViews);
  const order = ids.filter((id) => known.includes(id));
  if (order.length !== known.length || new Set(order).size !== order.length) return false;
  const entries = order.map((id) => [id, pageViews[id]]);
  known.forEach((id) => delete pageViews[id]);
  entries.forEach(([id, v]) => { pageViews[id] = v; });
  sendTabsToUI();
  return true;
});
ipcMain.handle('tab:navigate', async (e, id, url) => { navigateActive(url); return true; });
ipcMain.handle('tab:back', () => { const v = pageViews[activeTabId]; if (v && nav(v.webContents).canGoBack()) nav(v.webContents).goBack(); return true; });
ipcMain.handle('tab:forward', () => { const v = pageViews[activeTabId]; if (v && nav(v.webContents).canGoForward()) nav(v.webContents).goForward(); return true; });
ipcMain.handle('tab:reload', () => { const v = pageViews[activeTabId]; if (v) v.webContents.reload(); return true; });
ipcMain.on('layout:page-bounds', (e, b) => {
  pageBounds = { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) };
  const view = pageViews[activeTabId];
  if (view) { view.setBounds(pageBounds); view.webContents.invalidate(); }
});

/* ---------------- Barra de endereço e sugestões ----------------
   As sugestões vivem numa vista própria por cima das páginas: dentro da UI principal ficariam tapadas
   pela página aberta (as páginas são WebContentsViews empilhadas acima dela). */
const SUGGEST_ROW_H = 40;
const SUGGEST_MAX_H = 360;

function hideSuggestions() {
  if (suggestView && !suggestView.webContents.isDestroyed()) suggestView.setVisible(false);
}

ipcMain.handle('omnibox:go', async (e, text) => {
  const view = pageViews[activeTabId];
  if (!view) return false;
  hideSuggestions();
  navigateActive(settings.resolveInput(text));
  return true;
});

// Cada sugestão é texto de pesquisa ou, para "mudar para este separador", { text, label, tabId }.
const normalizeSuggestion = (it) => (it && typeof it === 'object'
  ? { text: String(it.text || ''), label: String(it.label || it.text || ''), tabId: typeof it.tabId === 'string' ? it.tabId : undefined }
  : { text: String(it), label: String(it) });

ipcMain.on('suggest:show', (e, payload) => {
  if (e.sender !== chromeView.webContents) return;
  const { items, selected, rect } = payload || {};
  if (!Array.isArray(items) || !items.length || !rect) { hideSuggestions(); return; }
  const height = Math.min(items.length * SUGGEST_ROW_H + 12, SUGGEST_MAX_H);
  suggestView.setBounds({ x: Math.round(rect.x), y: Math.round(rect.y + rect.height + 4), width: Math.round(rect.width), height });
  mainWindow.contentView.addChildView(suggestView);
  mainWindow.contentView.addChildView(overlayView);
  suggestView.webContents.send('suggest:render', { items: items.map(normalizeSuggestion), selected: Number.isInteger(selected) ? selected : -1 });
  suggestView.setVisible(true);
});
ipcMain.on('suggest:hide', (e) => { if (e.sender === chromeView.webContents) hideSuggestions(); });
ipcMain.on('suggest:pick', (e, item) => {
  if (e.sender !== suggestView.webContents) return;
  hideSuggestions();
  if (item && typeof item === 'object' && pageViews[item.tabId]) switchTab(item.tabId);
  else navigateActive(settings.resolveInput(String(item && item.text !== undefined ? item.text : item)));
  chromeView.webContents.send('omnibox:picked');
});

ipcMain.handle('get-suggestions', async (e, query) => {
  if (settings.get('privacy.suggestions') === false) return [];
  try {
    const res = await fetch('https://suggestqueries.google.com/complete/search?client=chrome&q=' + encodeURIComponent(query), { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    return data[1] || [];
  } catch (err) { return []; }
});

/* ---------------- Extensões: popup e menus da aplicação ---------------- */
ipcMain.on('extensions-popup:show', () => navigateActive('kortex://extensions'));
ipcMain.on('extensions-popup:manage', () => { overlayView.setVisible(false); navigateActive('kortex://extensions'); });
ipcMain.on('extensions-popup:click-ext', (e, extId) => { overlayView.setVisible(false); extMenu.openPopup(extId); });

const MENU_TARGETS = {
  'open-settings': 'kortex://settings',
  'open-history': 'kortex://history',
  'open-downloads': 'kortex://downloads',
  'open-bookmarks': 'kortex://bookmarks',
  'open-extensions': 'kortex://extensions'
};
ipcMain.on('menu:open', (e, { x, y }) => { overlayView.setVisible(true); mainWindow.contentView.addChildView(overlayView); overlayView.webContents.send('menu:state', { x, y }); });
ipcMain.on('menu:close', () => { overlayView.setVisible(false); chromeView.webContents.send('menu:closed'); });
ipcMain.on('menu:action', (e, action) => {
  overlayView.setVisible(false);
  chromeView.webContents.send('menu:closed');
  if (action === 'quit') { mainWindow.close(); return; }
  if (MENU_TARGETS[action]) navigateActive(MENU_TARGETS[action]);
});

ipcMain.on('window:minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window:maximize', () => { if (mainWindow) { mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(); } });
ipcMain.on('window:close', () => { if (mainWindow) mainWindow.close(); });

/* ---------------- Extensões: gestão ---------------- */
ipcMain.handle('ext:load-unpacked', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (canceled) return { success: false };
  const extPath = filePaths[0];
  try {
    const ex = await session.defaultSession.extensions.loadExtension(extPath);
    if (!savedExtensions.includes(extPath)) { savedExtensions.push(extPath); fs.writeFileSync(extensionsJsonPath, JSON.stringify(savedExtensions)); }
    return { success: true, ext: { id: ex.id, name: ex.name, version: ex.version, path: ex.path } };
  } catch (err) { return { success: false, error: err.message }; }
});
function kxFixMoji(s) {
  if (typeof s !== 'string') return s;
  if (!/[\u00C2\u00C3][\u0080-\u00BF]/.test(s)) return s;
  try { const r = Buffer.from(s, 'latin1').toString('utf8'); return r.indexOf('\uFFFD') === -1 ? r : s; } catch (e) { return s; }
}
function kxReadMeta(p) {
  const out = { name: null, description: null, icon: null };
  try {
    const m = JSON.parse(fs.readFileSync(path.join(p, 'manifest.json'), 'utf8').replace(/^\uFEFF/, ''));
    let msgs = null;
    const loadMsgs = (loc) => { try { return JSON.parse(fs.readFileSync(path.join(p, '_locales', loc, 'messages.json'), 'utf8').replace(/^\uFEFF/, '')); } catch (e) { return null; } };
    const tr = (v) => {
      if (typeof v !== 'string') return v;
      const mm = v.match(/^__MSG_(.+)__$/);
      if (!mm) return v;
      if (!msgs) {
        for (const c of [m.default_locale, 'en', 'en_US']) { if (c) { msgs = loadMsgs(c); if (msgs) break; } }
        if (!msgs) { try { const d = fs.readdirSync(path.join(p, '_locales')); if (d.length) msgs = loadMsgs(d[0]); } catch (e) { /* sem locales */ } }
        msgs = msgs || {};
      }
      const key = Object.keys(msgs).find((k) => k.toLowerCase() === mm[1].toLowerCase());
      return key && msgs[key] && msgs[key].message ? msgs[key].message : v;
    };
    out.name = tr(m.name);
    out.description = tr(m.description);
    const icons = Object.assign({}, m.icons || {}, (m.action && typeof m.action.default_icon === 'object') ? m.action.default_icon : {});
    const sizes = Object.keys(icons).map(Number).filter((n) => n > 0).sort((a, b) => a - b);
    const pick = sizes.filter((n) => n <= 128).pop() || sizes.pop();
    if (pick && icons[pick]) {
      const fp = path.join(p, String(icons[pick]));
      const ext = path.extname(fp).toLowerCase();
      const mime = ext === '.svg' ? 'image/svg+xml' : (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'image/png';
      if (fs.existsSync(fp) && fs.statSync(fp).size < 400000) out.icon = 'data:' + mime + ';base64,' + fs.readFileSync(fp).toString('base64');
    }
  } catch (e) { /* manifest ilegivel */ }
  return out;
}
ipcMain.handle('ext:load-path', async (e, p) => {
  try {
    let dir = String(p || '');
    if (dir && fs.existsSync(dir) && fs.statSync(dir).isFile()) dir = path.dirname(dir);
    if (!dir || !fs.existsSync(path.join(dir, 'manifest.json'))) return { success: false, error: 'A pasta não tem manifest.json.' };
    const ex = await session.defaultSession.extensions.loadExtension(dir);
    if (!savedExtensions.includes(dir)) { savedExtensions.push(dir); fs.writeFileSync(extensionsJsonPath, JSON.stringify(savedExtensions)); }
    return { success: true, ext: { id: ex.id, name: ex.name, version: ex.version, path: ex.path } };
  } catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('ext:list', () => {
  const dn = disabledExtensions.map(normalizePath);
  const active = session.defaultSession.extensions.getAllExtensions().filter((e) => !dn.includes(normalizePath(e.path))).map((e) => {
    const mt = kxReadMeta(e.path);
    const nm = (typeof e.name === 'string' && !/^__MSG_/.test(e.name)) ? e.name : (mt.name || e.name);
    return { id: e.id, name: kxFixMoji(nm), version: e.version, path: e.path, description: kxFixMoji(mt.description || e.description || ''), icon: mt.icon };
  });
  const dis = disabledExtensions.map((p) => {
    const mt = kxReadMeta(p);
    let version = '1.0';
    try { version = JSON.parse(fs.readFileSync(path.join(p, 'manifest.json'), 'utf8').replace(/^\uFEFF/, '')).version || version; } catch (e) { /* manter */ }
    const uid = 'disabled-' + crypto.createHash('sha1').update(normalizePath(p)).digest('hex').slice(0, 12);
    return { id: uid, name: kxFixMoji(mt.name || path.basename(p)), version, path: p, description: kxFixMoji(mt.description || 'Extensão desativada.'), disabled: true, icon: mt.icon };
  });
  return [...active, ...dis];
});ipcMain.handle('ext:toggle', async (e, id, pathStr, enable) => {
  if (!pathStr) return { success: false, error: 'Caminho inválido.' };
  const np = normalizePath(pathStr);
  if (enable) {
    const already = session.defaultSession.extensions.getAllExtensions().find((ex) => normalizePath(ex.path) === np);
    if (!already) { try { await session.defaultSession.extensions.loadExtension(pathStr); } catch (err) { return { success: false, error: err.message }; } }
    disabledExtensions = disabledExtensions.filter((p) => normalizePath(p) !== np);
    fs.writeFileSync(disabledExtPath, JSON.stringify(disabledExtensions));
    return { success: true };
  }
  if (!disabledExtensions.some((p) => normalizePath(p) === np)) { disabledExtensions.push(pathStr); fs.writeFileSync(disabledExtPath, JSON.stringify(disabledExtensions)); }
  const loaded = session.defaultSession.extensions.getAllExtensions().find((ex) => normalizePath(ex.path) === np);
  if (loaded) { try { session.defaultSession.extensions.removeExtension(loaded.id); } catch (err) { /* já removida */ } }
  return { success: true };
});
ipcMain.handle('ext:reload', async (e, id, pathStr) => {
  const np = normalizePath(pathStr);
  const loaded = session.defaultSession.extensions.getAllExtensions().find((ex) => normalizePath(ex.path) === np);
  if (!loaded) return { success: false, error: 'Extensão não está ativa.' };
  try {
    session.defaultSession.extensions.removeExtension(loaded.id);
    await new Promise((r) => setTimeout(r, 200));
    await session.defaultSession.extensions.loadExtension(pathStr);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('ext:remove', async (e, id, pathStr) => {
  try {
    const np = normalizePath(pathStr);
    savedExtensions = savedExtensions.filter((p) => normalizePath(p) !== np);
    disabledExtensions = disabledExtensions.filter((p) => normalizePath(p) !== np);
    fs.writeFileSync(extensionsJsonPath, JSON.stringify(savedExtensions));
    fs.writeFileSync(disabledExtPath, JSON.stringify(disabledExtensions));
    const ex = session.defaultSession.extensions.getExtension(id);
    if (ex) session.defaultSession.extensions.removeExtension(id);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('ext:get-details', async (e, id, pathStr) => {
  let extPath = pathStr;
  const ex = session.defaultSession.extensions.getExtension(id);
  if (ex) extPath = ex.path;
  if (!extPath) return { success: false, error: 'Caminho não encontrado.' };
  try {
    const m = ex ? (ex.manifest || {}) : JSON.parse(fs.readFileSync(path.join(extPath, 'manifest.json'), 'utf8'));
    const dirSize = (dir) => { let s = 0; try { fs.readdirSync(dir).forEach((f) => { const p = path.join(dir, f); s += fs.statSync(p).isDirectory() ? dirSize(p) : fs.statSync(p).size; }); } catch (e2) { /* pasta ilegível */ } return s; };
    const sb = dirSize(extPath);
    const size = sb > 1024 * 1024 ? (sb / (1024 * 1024)).toFixed(1) + ' MB' : (sb > 1024 ? (sb / 1024).toFixed(1) + ' KB' : sb + ' Bytes');
    let perms = m.permissions || [];
    let host = m.host_permissions || [];
    if (m.manifest_version === 2) { host = host.concat(perms.filter((p) => p.includes('://'))); perms = perms.filter((p) => !p.includes('://')); }
    return { success: true, name: ex ? ex.name : (m.name || 'Desconhecido'), description: m.description || 'Sem descrição.', version: ex ? ex.version : (m.version || '1.0'), id, path: extPath, size, permissions: perms, hostPermissions: host };
  } catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('ext:read-code', (e, extPath) => { try { return fs.readFileSync(path.join(extPath, 'manifest.json'), 'utf8'); } catch (err) { return `// Erro: ${err.message}`; } });

/* ---------------- Loja de extensões ---------------- */
ipcMain.handle('webstore:search', async (e, query) => {
  try {
    const response = await fetch('https://chromewebstore.google.com/search/' + encodeURIComponent(query) + '?hl=pt-PT', { headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8' } });
    const html = await response.text();
    const results = []; const seen = new Set();
    const regex = /\/detail\/([^/"']+)\/([a-p]{32})/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const rawSlug = match[1]; const id = match[2];
      if (!seen.has(id)) {
        seen.add(id);
        let d = rawSlug; try { d = decodeURIComponent(rawSlug); } catch (e2) { /* mantém o slug */ }
        const name = d.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        results.push({ id, name, img: `https://lh3.googleusercontent.com/${id}=s128` });
      }
      if (results.length >= 100) break;
    }
    return results;
  } catch (err) { return []; }
});
ipcMain.handle('webstore:get-icon', async (e, id) => {
  try {
    const response = await fetch('https://chromewebstore.google.com/detail/' + id, { headers: { 'User-Agent': USER_AGENT } });
    const html = await response.text();
    const match = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
    if (match && match[1]) { let i = match[1]; if (!i.includes('=s')) i += '=s128'; return i; }
  } catch (err) { /* sem ícone */ }
  return null;
});
ipcMain.handle('webstore:install', async (e, extId) => {
  try {
    const extDir = path.join(app.getPath('userData'), 'extensions', extId);
    if (fs.existsSync(extDir)) {
      await session.defaultSession.extensions.loadExtension(extDir);
      return { success: true, message: 'Extensão já instalada.' };
    }
    const crxUrl = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=120.0.0&acceptformat=crx3&x=id%3D${extId}%26uc`;
    const response = await fetch(crxUrl);
    if (!response.ok) throw new Error('Falha ao descarregar da Google.');
    const buffer = Buffer.from(await response.arrayBuffer());
    const zipStart = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04])); // início do ZIP dentro do .crx
    if (zipStart < 0) throw new Error('Formato de ficheiro inválido.');
    fs.mkdirSync(extDir, { recursive: true });
    new AdmZip(buffer.subarray(zipStart)).extractAllTo(extDir, true);
    if (!savedExtensions.includes(extDir)) { savedExtensions.push(extDir); fs.writeFileSync(extensionsJsonPath, JSON.stringify(savedExtensions)); }
    const loaded = await session.defaultSession.extensions.loadExtension(extDir);
    return { success: true, name: loaded.name };
  } catch (err) { return { success: false, error: err.message }; }
});

/* ---------------- Histórico ---------------- */
function saveToHistory(title, url) {
  if (!url || url === 'about:blank' || url.startsWith('kortex://') || url.startsWith('data:')) return;
  let history = [];
  if (fs.existsSync(historyPath)) { try { history = JSON.parse(fs.readFileSync(historyPath, 'utf8')); } catch (e) { /* recomeça vazio */ } }
  const i = history.findIndex((h) => h.url === url);
  if (i > -1) { history[i].visitCount = (history[i].visitCount || 1) + 1; history[i].title = title || history[i].title; history[i].date = Date.now(); const it = history.splice(i, 1)[0]; history.unshift(it); }
  else history.unshift({ title: title || url, url, date: Date.now(), visitCount: 1 });
  if (history.length > 5000) history = history.slice(0, 5000);
  fs.writeFileSync(historyPath, JSON.stringify(history));
  if (chromeView && !chromeView.webContents.isDestroyed()) chromeView.webContents.send('history:updated');
}
ipcMain.handle('history:get', () => { if (fs.existsSync(historyPath)) { try { return JSON.parse(fs.readFileSync(historyPath, 'utf8')); } catch (e) { return []; } } return []; });
ipcMain.handle('history:getTopSites', () => {
  if (!fs.existsSync(historyPath)) return [];
  try { const h = JSON.parse(fs.readFileSync(historyPath, 'utf8')); h.sort((a, b) => (b.visitCount || 1) - (a.visitCount || 1)); return h.slice(0, 5); } catch (e) { return []; }
});

/* ---------------- Preenchimento automático ---------------- */
const autofillPath = path.join(app.getPath('userData'), 'autofill.json');
const readAutofill = () => { try { return fs.existsSync(autofillPath) ? JSON.parse(fs.readFileSync(autofillPath, 'utf8')) : null; } catch (e) { return null; } };
const writeAutofill = (db) => fs.writeFileSync(autofillPath, JSON.stringify(db));

// Migração: palavras-passe antigas (texto simples) passam a cifradas no arranque.
function migrateAutofill() {
  const db = readAutofill();
  if (!db || !secrets.available()) return;
  let changed = false;
  for (const domain of Object.keys(db)) {
    const entry = db[domain];
    if (entry && typeof entry.password === 'string' && entry.password && !secrets.isEncrypted(entry.password)) {
      entry.password = secrets.encrypt(entry.password);
      changed = true;
    }
  }
  if (changed) { writeAutofill(db); console.log('[Kortex] palavras-passe migradas para armazenamento cifrado'); }
}

// Só devolve palavras-passe ao separador do próprio site (preenchimento); a lista das Definições nunca as recebe.
ipcMain.handle('autofill:get', (e, domain) => {
  const db = readAutofill();
  const entry = db && db[domain];
  if (!entry) return null;
  return { username: entry.username, password: secrets.decrypt(entry.password).value };
});
ipcMain.handle('autofill:list', () => {
  const db = readAutofill() || {};
  const out = {};
  for (const domain of Object.keys(db)) out[domain] = { username: db[domain].username };
  return out;
});
ipcMain.handle('autofill:delete', (e, domain) => { const db = readAutofill(); if (!db) return false; delete db[domain]; writeAutofill(db); return true; });

ipcMain.on('autofill:prompt-save', (e, { domain, username, password }) => {
  const bounds = mainWindow.getBounds();
  const win = new BrowserWindow({ width: 360, height: 220, x: Math.round(bounds.x + (bounds.width / 2) - 180), y: Math.round(bounds.y + (bounds.height / 2) - 110), frame: false, resizable: false, alwaysOnTop: true, backgroundColor: '#1a1b1d', webPreferences: { nodeIntegration: true, contextIsolation: false } });
  const ds = encodeURIComponent(JSON.stringify({ domain, username, password }));
  const safeDomain = String(domain).replace(/[<>&"']/g, '');
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <body style="font-family:sans-serif;color:white;padding:20px;text-align:center;background:#1a1b1d;margin:0">
    <h3>Guardar Palavra-passe?</h3>
    <p style="font-size:13px;color:#888">O Kortex quer guardar os dados para <b>${safeDomain}</b>.</p>
    <button id="yes" style="background:#ff5722;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;margin-right:10px">Sim</button>
    <button id="no" style="background:#38393d;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer">Não</button>
    <script>const{ipcRenderer}=require('electron');const d=JSON.parse(decodeURIComponent("${ds}"));document.getElementById('yes').onclick=()=>{ipcRenderer.send('autofill:do-save',d);window.close();};document.getElementById('no').onclick=()=>window.close();</script>
    </body>
  `)}`);
});
ipcMain.on('autofill:do-save', (e, data) => {
  const db = readAutofill() || {};
  const enc = secrets.encrypt(data.password);
  if (enc === null) { console.warn('[Kortex] cifra indisponível: palavra-passe não guardada'); return; }
  db[data.domain] = { username: data.username, password: enc };
  writeAutofill(db);
});

/* ---------------- Limpar dados ---------------- */
ipcMain.handle('clear-data:stats', async () => {
  const c = await session.defaultSession.getCacheSize();
  const ck = await session.defaultSession.cookies.get({});
  const cacheSize = c > 1024 * 1024 ? (c / (1024 * 1024)).toFixed(1) + ' MB' : (c > 1024 ? (c / 1024).toFixed(1) + ' KB' : '0 KB');
  let historyCount = 0;
  try { historyCount = JSON.parse(fs.readFileSync(historyPath, 'utf8')).length; } catch (e) { /* sem histórico */ }
  return { cacheSize, cookiesCount: ck.length, historyCount };
});
ipcMain.handle('clear-data:execute', async (e, options) => {
  if (options.cookies) {
    if (options.timeRange === 'all') await session.defaultSession.clearStorageData({ storages: ['cookies'] });
    else {
      const ck = await session.defaultSession.cookies.get({}); const now = Math.floor(Date.now() / 1000);
      const tl = options.timeRange === '15m' ? 900 : (options.timeRange === '1h' ? 3600 : 86400);
      for (const c of ck) { if (c.creationDate && (now - c.creationDate <= tl)) await session.defaultSession.cookies.remove(`http${c.secure ? 's' : ''}://${c.domain}${c.path}`, c.name); }
    }
  }
  if (options.cache) await session.defaultSession.clearCache();
  if (options.hostedApps) await session.defaultSession.clearStorageData({ storages: ['localstorage', 'indexdb', 'websql', 'serviceworkers'] });
  if (options.autofill) { if (fs.existsSync(autofillPath)) fs.writeFileSync(autofillPath, JSON.stringify({})); }
  if (options.history) {
    let h = []; try { h = JSON.parse(fs.readFileSync(historyPath, 'utf8')); } catch (e) { /* sem histórico */ }
    const limits = { '15m': 15 * 60e3, '1h': 3600e3 };
    const keep = options.timeRange === 'all' ? [] : h.filter((i) => Date.now() - (i.date || 0) > (limits[options.timeRange] || 86400e3));
    fs.writeFileSync(historyPath, JSON.stringify(keep));
  }
  return true;
});

/* ---------------- Skills do assistente ---------------- */
async function aplicarSkills(messages, appSettings, tabId, views) {
  let systemPrompt = 'És o Kortex, um assistente AI focado em ajudar o utilizador.';
  const tools = settings.get('plugins') || {};
  let pageContext = '';
  let pageAccessBlocked = false;
  if (tabId && views && views[tabId]) {
    try {
      const hasPageTools = tools['summarize-page'] || tools['extract-data'] || tools['translate-page'] || tools['seo-analyzer'] || tools['competitor-analysis'] || tools['price-extractor'] || tools['invoice-parser'] || tools['page-reader'];
      if (hasPageTools) {
        const view = views[tabId];
        if (view.isPrivate || !settings.get('assistant.pageAccess')) pageAccessBlocked = true;
        else pageContext = await view.webContents.executeJavaScript('document.body.innerText.substring(0, 15000)');
      }
    } catch (e) { /* página sem corpo legível */ }
  }
  if (pageAccessBlocked) systemPrompt += '\n\n[AVISO] O utilizador não permitiu que leias a página.';
  if (tools['code-reviewer']) systemPrompt += '\n\n[SKILL: Code Reviewer] Analisa o código fornecido, aponta bugs, sugere otimizações.';
  if (tools['regex-wizard']) systemPrompt += '\n\n[SKILL: Regex Wizard] Gera Expressões Regulares perfeitas.';
  if (tools['sql-expert']) systemPrompt += '\n\n[SKILL: SQL Expert] Cria queries SQL robustas.';
  if (tools['docker-helper']) systemPrompt += '\n\n[SKILL: Docker Expert] Ajuda com Dockerfiles.';
  if (tools['git-assistant']) systemPrompt += '\n\n[SKILL: Git Assistant] Resolve problemas de Git.';
  if (tools['summarize-page'] && pageContext) systemPrompt += `\n\n[SKILL: Resumir] Cria um resumo:\n"""\n${pageContext}\n"""`;
  if (tools['extract-data'] && pageContext) systemPrompt += `\n\n[SKILL: Extrair Dados] Extrai dados para JSON:\n"""\n${pageContext}\n"""`;
  if (tools['translate-page'] && pageContext) systemPrompt += `\n\n[SKILL: Traduzir] Traduz para Português:\n"""\n${pageContext}\n"""`;
  if (tools['email-writer']) systemPrompt += '\n\n[SKILL: Email Writer] Escreve emails profissionais.';
  if (tools['competitor-analysis'] && pageContext) systemPrompt += `\n\n[SKILL: Análise de Concorrência] Analisa:\n"""\n${pageContext}\n"""`;
  if (tools['swot-analyzer']) systemPrompt += '\n\n[SKILL: SWOT] Cria uma análise SWOT.';
  if (tools['seo-analyzer'] && pageContext) systemPrompt += `\n\n[SKILL: SEO] Sugere melhorias de SEO:\n"""\n${pageContext}\n"""`;
  if (tools['copywriter']) systemPrompt += '\n\n[SKILL: Copywriter] Escreve copy de vendas.';
  if (tools['price-extractor'] && pageContext) systemPrompt += `\n\n[SKILL: Extrator de Preços] Extrai produtos e preços:\n"""\n${pageContext}\n"""`;
  if (tools['review-analyzer'] && pageContext) systemPrompt += `\n\n[SKILL: Analisar Reviews] Analisa sentimento:\n"""\n${pageContext}\n"""`;
  if (tools['stock-analyst']) systemPrompt += '\n\n[SKILL: Analista de Ações] Fornece análises financeiras.';
  if (tools['crypto-tracker']) systemPrompt += '\n\n[SKILL: Crypto Tracker] Ajuda com criptomoedas.';
  if (tools['tax-helper']) systemPrompt += '\n\n[SKILL: Fiscal] Ajuda a calcular impostos.';
  if (tools['invoice-parser'] && pageContext) systemPrompt += `\n\n[SKILL: Faturas] Extrai dados de fatura:\n"""\n${pageContext}\n"""`;
  if (tools['web-search']) systemPrompt += '\n\n[PLUGIN: Pesquisa Web] Se precisares de info recente, responde com: {"action": "search", "query": "termo"}';
  if (tools['page-reader'] && pageContext && !tools['summarize-page']) systemPrompt += `\n\n[PLUGIN: Page Reader] Contexto:\n${pageContext}`;
  return systemPrompt;
}

/* ---------------- Propagar alterações de definições ---------------- */
settings.onChanged((key, value) => {
  try {
    if (chromeView && !chromeView.webContents.isDestroyed()) chromeView.webContents.send('settings:changed', { key, value });
    if (overlayView && !overlayView.webContents.isDestroyed()) overlayView.webContents.send('settings:changed', { key, value });
    if (activeTabId && pageViews[activeTabId]) pageViews[activeTabId].webContents.send('settings:changed', { key, value });
  } catch (e) { /* janela a fechar */ }
});


/* ===== Kortex (repair script): gestao de contas Google ===== */
try {

} catch (kortexWiringErr) { console.error('[kortex] google-accounts:', kortexWiringErr); }



app.on('web-contents-created', (e, wc) => { try { require('./external-protocols').hook(wc); } catch(e) {} });
try { require('./context-menus').init({ createNewTab: (u) => createNewTab(u), getChromeView: () => chromeView, getPageViews: () => pageViews, getSettings: () => settings }); } catch (e) { console.error('[ctx-menu]', e); }

/* KORTEX-DRM-FIX v2 inicio - UA Chrome + shim + limpeza 1x - gerado automaticamente */
const { app: __kDrmApp, session: __kDrmSession } = require('electron');
const __kFs = require('fs');
const __kOs = require('os');
const __kPath = require('path');
try {
  const __kMajor = String((process.versions.chrome || '124.0.0.0').split('.')[0] || '124');
  const __kDrmUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' + (process.versions.chrome || '124.0.0.0') + ' Safari/537.36';
  __kDrmApp.userAgentFallback = __kDrmUa;
  try { __kDrmApp.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required'); } catch (e0) {}

  const __kShimMain = [
    '(function () {',
    '  try {',
    "    if (typeof navigator.userAgentData === 'undefined') {",
    "      const __v = '" + __kMajor + "';",
    "      const __fl = [{ brand: 'Not_A Brand', version: '99' }, { brand: 'Chromium', version: __v }, { brand: 'Google Chrome', version: __v }];",
    '      const __ud = {',
    '        brands: __fl,',
    '        mobile: false,',
    "        platform: 'Windows',",
    '        toJSON: function () { return { brands: __fl, mobile: false, platform: "Windows" }; },',
    '        getHighEntropyValues: function (hints) {',
    '          const __all = { architecture: "x86", bitness: "64", model: "", platformVersion: "15.0.0", uaFullVersion: __v + ".0.0.0", fullVersionList: __fl, mobile: false, platform: "Windows", wow64: false, formFactors: ["Desktop"] };',
    '          const __o = {};',
    '          (hints || []).forEach(function (h) { if (h in __all) __o[h] = __all[h]; });',
    '          return Promise.resolve(__o);',
    '        }',
    '      };',
    "      Object.defineProperty(navigator, 'userAgentData', { get: function () { return __ud; }, configurable: true });",
    '    }',
    "    if (navigator.vendor !== 'Google Inc.') { Object.defineProperty(navigator, 'vendor', { get: function () { return 'Google Inc.'; }, configurable: true }); }",
    '    if (!window.chrome) { Object.defineProperty(window, "chrome", { get: function () { return window.__kChrome || (window.__kChrome = { runtime: { connect: function () {}, sendMessage: function () {}, onMessage: { addListener: function () {} } }, app: { isInstalled: false, getDetails: function () {} }, csi: function () { return {}; }, loadTimes: function () { return {}; } }); }, configurable: true }); }',
    "    if (location && location.hostname && location.hostname.indexOf('spotify.com') >= 0) {",
    '      try { Object.defineProperty(window, "process", { get: function () { return undefined; }, configurable: true }); } catch (e) {}',
    '    }',
    '  } catch (e) {}',
    '})();'
  ].join('\n');

  const __kShimPath = __kPath.join(__kOs.tmpdir(), 'kortex-ua-shim.js');
  try {
    __kFs.writeFileSync(__kShimPath, "const { webFrame } = require('electron'); try { webFrame.executeJavaScript(" + JSON.stringify(__kShimMain) + ", true).catch(function () {}); } catch (e) {}", 'utf8');
  } catch (e1) {}

  const __kDrmDone = new WeakSet();
  const __kDrmFixSession = function (__kSes) {
    try {
      if (!__kSes || __kDrmDone.has(__kSes)) return;
      __kDrmDone.add(__kSes);
      try { __kSes.setUserAgent(__kDrmUa); } catch (e2) {}
      try {
        __kSes.webRequest.onBeforeSendHeaders({ urls: ['*://*.spotify.com/*', '*://*.scdn.co/*', '*://*.spotifycdn.com/*'] }, function (details, callback) {
          try {
            const __h = Object.assign({}, details.requestHeaders);
            __h['User-Agent'] = __kDrmUa;
            callback({ requestHeaders: __h });
          } catch (e3) { try { callback({}); } catch (e4) {} }
        });
      } catch (e5) {}
      try {
        if (typeof __kSes.registerPreloadScript === 'function') {
          __kSes.registerPreloadScript({ id: 'kortex-ua-shim', type: 'frame', filePath: __kShimPath });
        } else {
          __kSes.setPreloads([__kShimPath]);
        }
      } catch (e6) { console.log('[kortex-drm-fix] registerPreloadScript falhou:', e6 && e6.message); try { __kSes.setPreloads([__kShimPath]); } catch (e7) {} }
      try {
        const __kFlag = __kPath.join(__kDrmApp.getPath('userData'), 'kortex-drm-fix-v2-cleared.flag');
        if (!__kFs.existsSync(__kFlag)) {
          const __kMark = function () { try { __kFs.writeFileSync(__kFlag, new Date().toISOString(), 'utf8'); } catch (e16) {} };
          const __kClear = function () {
            try {
              __kSes.clearStorageData({ origin: 'https://open.spotify.com', storages: ['localstorage', 'indexdb', 'serviceworkers', 'cachestorage'] }).then(function () { __kMark(); }).catch(function () {});
            } catch (e14) {}
            try {
              __kSes.cookies.get({ domain: 'spotify.com' }).then(function (cs) {
                (cs || []).forEach(function (c) {
                  const __u = (c.secure ? 'https://' : 'http://') + String(c.domain).replace(/^\./, '') + (c.path || '/');
                  __kSes.cookies.remove({ url: __u, name: c.name }).catch(function () {});
                });
                __kMark();
                if (cs && cs.length) console.log('[kortex-drm-fix] estado antigo do Spotify limpo (cookies incluidos) - inicia sessao no Spotify 1x');
              }).catch(function () {});
            } catch (e15) {}
          };
          if (__kDrmApp.isReady()) { __kClear(); } else { __kDrmApp.whenReady().then(__kClear).catch(function () {}); }
        }
      } catch (e8) {}
    } catch (e9) { console.error('[kortex-drm-fix] session:', e9 && e9.message ? e9.message : e9); }
  };
  __kDrmApp.on('session-created', __kDrmFixSession);
  __kDrmApp.whenReady().then(function () { try { __kDrmFixSession(__kDrmSession.defaultSession); } catch (e13) {} }).catch(function () {});
  __kDrmApp.on('web-contents-created', function (__ev, __kWc) {
    __kWc.on('will-attach-webview', function (__ev2, params) {
      try {
        if (params && params.src && params.src.indexOf('spotify.com') >= 0) params.useragent = __kDrmUa;
      } catch (e10) {}
    });
    __kWc.on('did-attach-webview', function (__ev3, __kWv) {
      try {
        if (__kWv) {
          const __u2 = __kWv.getURL ? __kWv.getURL() : '';
          if (__u2 && __u2.indexOf('spotify.com') >= 0) { __kWv.executeJavaScript(__kShimMain, true).catch(function () {}); }
        }
      } catch (e11) {}
    });
  });
  console.log('[kortex-drm-fix v2] ativo - UA Chrome + shim userAgentData/vendor + limpeza 1x do estado Spotify');
} catch (e12) { console.error('[kortex-drm-fix] falhou:', e12 && e12.message ? e12.message : e12); }
/* KORTEX-DRM-FIX v2 fim */

