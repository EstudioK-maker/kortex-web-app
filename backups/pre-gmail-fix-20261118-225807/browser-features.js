// src/main/browser-features.js — funcionalidades de navegador "a sério" para o Kortex
const { app, session, ipcMain, Menu, dialog, shell, clipboard, BrowserWindow, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { applyContrastFix } = require('./contrast-fix');
const gmailTheme = require('./gmail-theme');

let ctx = null;
const file = (n) => path.join(app.getPath('userData'), n);
const readJson = (n, d) => { try { return JSON.parse(fs.readFileSync(file(n), 'utf8')); } catch (e) { return d; } };
const writeJson = (n, v) => { try { fs.writeFileSync(file(n), JSON.stringify(v)); } catch (e) {} };
const toChrome = (ch, data) => { const cv = ctx && ctx.getChromeView(); if (cv && !cv.webContents.isDestroyed()) cv.webContents.send(ch, data); };
const views = () => ctx.getViews();
const active = () => views()[ctx.getActiveId()];
const note = (m) => toChrome('toast', m);
const askAI = (text) => toChrome('assistant:ask', { text });
const navOf = (wc) => wc.navigationHistory || wc;
let refreshTimer = null;
const refresh = () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => ctx.sendTabsToUI(), 60); };

/* ---------------- Marcadores ---------------- */
let bookmarks = null;
const bm = () => (bookmarks = bookmarks || readJson('bookmarks.json', []));
function toggleBookmark(url, title) {
  if (!/^(https?:|kortex:)/i.test(url || '')) return { ok: false };
  const list = bm(); const i = list.findIndex((b) => b.url === url);
  if (i > -1) list.splice(i, 1); else list.push({ id: crypto.randomUUID(), url, title: title || url, added: Date.now() });
  writeJson('bookmarks.json', list); toChrome('bookmarks:changed');
  return { ok: true, bookmarked: i === -1 };
}

function setupBookmarks() {
  ipcMain.handle('bookmarks:list', () => bm());
  ipcMain.handle('bookmarks:is', (e, url) => bm().some((b) => b.url === url));
  ipcMain.handle('bookmarks:toggle', (e, { url, title } = {}) => toggleBookmark(url, title));
  ipcMain.handle('bookmarks:remove', (e, id) => { bookmarks = bm().filter((b) => b.id !== id); writeJson('bookmarks.json', bookmarks); toChrome('bookmarks:changed'); return true; });
}

/* ---------------- Histórico ---------------- */
function setupHistory() {
  const read = () => { try { return JSON.parse(fs.readFileSync(ctx.historyPath, 'utf8')); } catch (e) { return []; } };
  ipcMain.handle('history:remove', (e, url) => { fs.writeFileSync(ctx.historyPath, JSON.stringify(read().filter((h) => h.url !== url))); toChrome('history:updated'); return true; });
  ipcMain.handle('history:clear', () => { fs.writeFileSync(ctx.historyPath, '[]'); toChrome('history:updated'); return true; });
}

/* ---------------- Transferências ---------------- */
const downloads = []; const dlItems = new Map();
function setupDownloads() {
  readJson('downloads.json', []).forEach((d) => downloads.push(d.state === 'progressing' ? { ...d, state: 'interrupted' } : d));
  session.defaultSession.on('will-download', (e, item) => {
    const d = { id: crypto.randomUUID(), name: item.getFilename(), url: item.getURL(), total: item.getTotalBytes(), received: 0, state: 'progressing', path: '', date: Date.now() };
    downloads.unshift(d); dlItems.set(d.id, item); const push = () => toChrome('downloads:updated', d); push();
    item.on('updated', (_e, state) => { d.received = item.getReceivedBytes(); d.total = item.getTotalBytes(); d.state = state === 'interrupted' ? 'interrupted' : (item.isPaused() ? 'paused' : 'progressing'); d.path = item.getSavePath() || d.path; push(); });
    item.once('done', (_e, state) => { d.state = state; d.received = item.getReceivedBytes(); d.path = item.getSavePath() || d.path; dlItems.delete(d.id); writeJson('downloads.json', downloads.slice(0, 200)); push(); if (state === 'completed') note('Download concluído: ' + d.name); });
  });
  ipcMain.handle('downloads:list', () => downloads.slice(0, 200));
  ipcMain.handle('downloads:open', (e, id) => { const d = downloads.find((x) => x.id === id); if (d && d.path && fs.existsSync(d.path)) return shell.openPath(d.path); });
  ipcMain.handle('downloads:show', (e, id) => { const d = downloads.find((x) => x.id === id); if (d && d.path) shell.showItemInFolder(d.path); return true; });
}

/* ---------------- Permissões ---------------- */
const AUTO_ALLOW = new Set(['fullscreen', 'clipboard-sanitized-write', 'pointerLock', 'keyboardLock', 'mediaKeySystem', 'media', 'display-capture']);
const ASK = new Set(['media', 'geolocation', 'notifications', 'midi', 'midiSysex', 'clipboard-read']);
let perms = null;
function describePermission(permission, details) {
  switch (permission) {
    case 'media': { const t = (details && details.mediaTypes) || []; return t.includes('video') && t.includes('audio') ? 'usar a câmara e o microfone' : t.includes('video') ? 'usar a câmara' : 'usar o microfone'; }
    case 'geolocation': return 'saber a tua localização'; case 'notifications': return 'enviar-te notificações'; case 'display-capture': return 'partilhar o teu ecrã'; case 'clipboard-read': return 'ler a área de transferência'; default: return 'usar a permissão "' + permission + '"';
  }
}
function setupPermissions(ses, { persist = true } = {}) {
  const store = persist ? (perms = perms || readJson('permissions.json', {})) : {};
  ses.setPermissionCheckHandler((wc, permission, origin) => AUTO_ALLOW.has(permission) || store[origin + '|' + permission] === true);
  ses.setPermissionRequestHandler(async (wc, permission, callback, details) => {
    if (AUTO_ALLOW.has(permission)) return callback(true); if (!ASK.has(permission)) return callback(false);
    let origin = ''; try { origin = new URL(details.requestingUrl || wc.getURL()).origin; } catch (e) {}
    if (!origin || origin === 'null') return callback(false);
    const k = origin + '|' + permission; if (k in store) return callback(store[k]);
    const r = await dialog.showMessageBox({ type: 'question', buttons: ['Permitir', 'Bloquear'], defaultId: 1, cancelId: 1, message: origin + ' quer ' + describePermission(permission, details) });
    const allowed = r.response === 0; store[k] = allowed; if (persist) writeJson('permissions.json', store); callback(allowed);
  });
}

/* ---------------- Atalhos ---------------- */
function attach(wc) {
  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const ctrl = input.control || input.meta; const key = (input.key || '').toLowerCase();
    const run = (fn) => { event.preventDefault(); try { fn(); } catch (e) {} };
    const v = active(); const awc = v && v.webContents;
    if (key === 'f12' || (ctrl && input.shift && key === 'i')) return run(() => awc && awc.toggleDevTools());
    if (ctrl && input.shift && key === 'g') return run(() => require('./google-accounts').openPopup());
    if (ctrl && key === 't') return run(() => ctx.createNewTab());
    if (ctrl && key === 'w') return run(() => ctx.closeTab(ctx.getActiveId()));
    if (ctrl && key === 'l') return run(() => { toChrome('focus-url'); ctx.getChromeView().webContents.focus(); });
  });
}

/* ---------------- Pesquisa ---------------- */
function setupFind() {
  ipcMain.on('find:start', (e, { text, forward = true, next = false } = {}) => { const v = active(); if (!v || !text) return; v.webContents.findInPage(String(text), { forward, findNext: next }); });
  ipcMain.on('find:stop', () => { const v = active(); if (v && !v.webContents.isDestroyed()) v.webContents.stopFindInPage('clearSelection'); });
}

/* ---------------- Página de erro ---------------- */
function errorPage(url, desc) {
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  return '<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"><title>Erro</title><style>body{margin:0;height:100vh;display:grid;place-items:center;background:#1a1b1d;color:#ececee;font-family:"Segoe UI",sans-serif}</style></head><body><div><h1>Não foi possível aceder</h1><p><code>' + esc(url) + '</code></p><p>' + esc(desc) + '</p></div></body></html>';
}

/* ---------------- Ligações por separador ---------------- */
function attachView(id, view) {
  const wc = view.webContents;
  attach(wc);

  wc.on('page-favicon-updated', (e, favs) => { view.favicon = (favs && favs[0]) || ''; refresh(); });
  wc.on('did-start-loading', () => { view.loading = true; refresh(); });
  wc.on('did-stop-loading', () => { view.loading = false; refresh(); });
  wc.on('audio-state-changed', refresh);

  wc.on('dom-ready', () => {
    applyContrastFix(wc);
    if (typeof gmailTheme !== 'undefined' && gmailTheme) 
  });

   fs.writeFileSync(FILE, JSON.stringify(list)); }
        googleAccounts.openPopup(wc); // Reabre atualizado
      }
    } else if (url.startsWith('kortex://google-accounts-switch')) {
      e.preventDefault();
      const urlObj = new URL(url.replace('kortex://', 'http://'));
      const email = urlObj.searchParams.get('email');
      if (email && ctx && ctx.createNewTab) {
         ctx.createNewTab('https://accounts.google.com/AccountChooser?Email=' + encodeURIComponent(email) + '&continue=https://mail.google.com/');
      }
    }
  });

  wc.on('did-navigate', (e, url) => { 
    view.lastUrl = url; 
    view.favicon = ''; 
    if (!/^(data:|kortex:\/\/certerror)/i.test(String(url))) view.failedUrl = ''; 
    refresh(); 
  });
  wc.on('did-navigate-in-page', (e, url, isMain) => { if (isMain) { view.lastUrl = url; refresh(); } });
  wc.on('found-in-page', (e, r) => { if (view === active()) toChrome('find:result', { active: r.activeMatchOrdinal, total: r.matches }); });
  wc.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 || code === 0) return;
    if (/^(kortex|view-source|data):/i.test(url)) return;
    view.failedUrl = url;
    if (/^ERR_CERT_/.test(desc || '')) wc.loadURL('kortex://certerror/?' + new URLSearchParams({ url, desc }).toString());
    else wc.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(errorPage(url, desc)));
  });
}

function onClose(view) {
  const u = view && view.lastUrl;
  if (view && !view.isPrivate && /^(https?|kortex):/i.test(u || '')) { }
}

function tabInfo(id, base) {
  const v = views()[id]; if (!v) return base;
  return { ...base, url: v.lastUrl || base.url, favicon: v.favicon || '', loading: !!v.loading, pinned: !!v.pinned };
}

function init(c) {
  ctx = c;
  setupBookmarks(); setupHistory(); setupDownloads(); setupFind();
  setupPermissions(session.defaultSession);
}

const setupSession = (ses) => { setupPermissions(ses, { persist: false }); };

module.exports = { init, attach, attachView, onClose, tabInfo, setupSession, askAI };


wc.on('will-navigate', (e, url) => {
  if (url.startsWith('kortex://google-accounts')) {
    e.preventDefault();
    try {
      const googleAccounts = require('./google-accounts');
      googleAccounts.openPopup(wc);
    } catch (err) { console.error('Erro ao abrir contas:', err); }
  }
});
