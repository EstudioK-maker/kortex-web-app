// src/main/browser-features.js
const { app, session, ipcMain, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let ctx = null;
const file = (n) => path.join(app.getPath('userData'), n);
const readJson = (n, d) => { try { return JSON.parse(fs.readFileSync(file(n), 'utf8')); } catch { return d; } };
const writeJson = (n, v) => { try { fs.writeFileSync(file(n), JSON.stringify(v)); } catch {} };
const toChrome = (ch, data) => { const cv = ctx && ctx.getChromeView(); if (cv && !cv.webContents.isDestroyed()) cv.webContents.send(ch, data); };
const views = () => ctx.getViews();
const active = () => views()[ctx.getActiveId()];
const note = (m) => toChrome('toast', m);
const navOf = (wc) => wc.navigationHistory || wc;
let refreshTimer = null;
const refresh = () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => ctx.sendTabsToUI(), 60); };

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

function setupHistory() {
  const read = () => { try { return JSON.parse(fs.readFileSync(ctx.historyPath, 'utf8')); } catch { return []; } };
  ipcMain.handle('history:remove', (e, url) => { fs.writeFileSync(ctx.historyPath, JSON.stringify(read().filter((h) => h.url !== url))); toChrome('history:updated'); return true; });
  ipcMain.handle('history:clear', () => { fs.writeFileSync(ctx.historyPath, '[]'); toChrome('history:updated'); return true; });
}

const downloads = [];
const dlItems = new Map();
function setupDownloads() {
  readJson('downloads.json', []).forEach((d) => downloads.push(d.state === 'progressing' ? { ...d, state: 'interrupted' } : d));
  session.defaultSession.on('will-download', (e, item) => {
    const d = { id: crypto.randomUUID(), name: item.getFilename(), url: item.getURL(), total: item.getTotalBytes(), received: 0, state: 'progressing', path: '', date: Date.now() };
    downloads.unshift(d); dlItems.set(d.id, item);
    const push = () => toChrome('downloads:updated', d);
    push();
    item.on('updated', (_e, state) => { d.received = item.getReceivedBytes(); d.total = item.getTotalBytes(); d.state = state === 'interrupted' ? 'interrupted' : (item.isPaused() ? 'paused' : 'progressing'); d.path = item.getSavePath() || d.path; push(); });
    item.once('done', (_e, state) => { d.state = state; d.received = item.getReceivedBytes(); d.path = item.getSavePath() || d.path; dlItems.delete(d.id); writeJson('downloads.json', downloads.slice(0, 200)); push(); if (state === 'completed') note('Download concluído: ' + d.name); });
  });
  ipcMain.handle('downloads:list', () => downloads.slice(0, 200));
  ipcMain.handle('downloads:open', (e, id) => { const d = downloads.find((x) => x.id === id); if (d && d.path && fs.existsSync(d.path)) return shell.openPath(d.path); });
  ipcMain.handle('downloads:show', (e, id) => { const d = downloads.find((x) => x.id === id); if (d && d.path) shell.showItemInFolder(d.path); return true; });
  ipcMain.handle('downloads:cancel', (e, id) => { const it = dlItems.get(id); if (it) it.cancel(); return true; });
  ipcMain.handle('downloads:clear', () => { for (let i = downloads.length - 1; i >= 0; i--) if (downloads[i].state !== 'progressing') downloads.splice(i, 1); writeJson('downloads.json', downloads); return true; });
}

const AUTO_ALLOW = new Set(['fullscreen', 'clipboard-sanitized-write', 'pointerLock', 'keyboardLock', 'mediaKeySystem']);
const ASK = new Set(['media', 'geolocation', 'notifications', 'midi', 'midiSysex', 'display-capture', 'clipboard-read']);
let perms = null;
const pending = new Map();
function describePermission(permission, details) {
  switch (permission) {
    case 'media': { const t = (details && details.mediaTypes) || []; return t.includes('video') && t.includes('audio') ? 'usar a câmara e o microfone' : t.includes('video') ? 'usar a câmara' : 'usar o microfone'; }
    case 'geolocation': return 'saber a tua localização';
    case 'notifications': return 'enviar-te notificações';
    case 'display-capture': return 'partilhar o teu ecrã';
    case 'clipboard-read': return 'ler a área de transferência';
    case 'midi': case 'midiSysex': return 'aceder a dispositivos MIDI';
    default: return 'usar a permissão "' + permission + '"';
  }
}
async function askPermission(origin, permission, details, k) {
  let host = origin; try { host = new URL(origin).host; } catch {}
  const r = await dialog.showMessageBox({ type: 'question', buttons: ['Permitir', 'Bloquear'], defaultId: 1, cancelId: 1, title: 'Pedido de permissão', message: `${host} quer ${describePermission(permission, details)}`, checkboxLabel: 'Lembrar a minha escolha para este site', checkboxChecked: true });
  const allowed = r.response === 0;
  if (r.checkboxChecked) { perms[k] = allowed; writeJson('permissions.json', perms); }
  return allowed;
}
function setupPermissions(ses) {
  perms = perms || readJson('permissions.json', {});
  const key = (origin, p) => origin + '|' + p;
  ses.setPermissionCheckHandler((wc, permission, origin) => AUTO_ALLOW.has(permission) || perms[key(origin, permission)] === true);
  ses.setPermissionRequestHandler(async (wc, permission, callback, details) => {
    if (AUTO_ALLOW.has(permission)) return callback(true);
    if (!ASK.has(permission)) return callback(false);
    let origin = ''; try { origin = new URL(details.requestingUrl || wc.getURL()).origin; } catch {}
    if (!origin || origin === 'null') return callback(false);
    const k = key(origin, permission);
    if (k in perms) return callback(perms[k]);
    if (pending.has(k)) return pending.get(k).then(callback);
    const p = askPermission(origin, permission, details, k);
    pending.set(k, p);
    let allowed = false; try { allowed = await p; } finally { pending.delete(k); }
    callback(allowed);
  });
}

const closed = [];
function zoom(delta, reset) { const v = active(); if (!v) return; const wc = v.webContents; const z = reset ? 1 : Math.min(3, Math.max(0.25, +(wc.getZoomFactor() + delta).toFixed(2))); wc.setZoomFactor(z); note('Zoom: ' + Math.round(z * 100) + '%'); }
function cycle(dir) { const ids = Object.keys(views()); if (ids.length < 2) return; const i = ids.indexOf(ctx.getActiveId()); ctx.switchTab(ids[(i + dir + ids.length) % ids.length]); }
function openInternal(url) { const v = active(); const cur = v ? v.webContents.getURL() : ''; if (v && (cur === '' || cur === 'about:blank')) v.webContents.loadURL(url); else ctx.createNewTab(url); }
function reopenClosed() { const u = closed.pop(); if (u) ctx.createNewTab(u); }

function attach(wc) {
  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const ctrl = input.control || input.meta;
    const key = (input.key || '').toLowerCase();
    const run = (fn) => { event.preventDefault(); try { fn(); } catch (e) { console.error('[Kortex] atalho:', e); } };
    const v = active(); const awc = v && v.webContents;
    if (key === 'escape') { toChrome('find:close'); return; }
    if (key === 'f12' || (ctrl && input.shift && key === 'i')) return run(() => awc && awc.toggleDevTools());
    if (key === 'f11') return run(() => { const w = ctx.getMainWindow(); w.setFullScreen(!w.isFullScreen()); });
    if (key === 'f5') return run(() => awc && awc.reload());
    if (input.alt && !ctrl && (key === 'arrowleft' || key === 'arrowright')) return run(() => { if (!awc) return; const h = navOf(awc); if (key === 'arrowleft') { if (h.canGoBack()) h.goBack(); } else if (h.canGoForward()) h.goForward(); });
    if (!ctrl) return;
    if (key === '+' || key === '=') return run(() => zoom(0.1));
    if (key === '-') return run(() => zoom(-0.1));
    if (key === '0') return run(() => zoom(0, true));
    if (input.shift) {
      if (key === 't') return run(reopenClosed);
      if (key === 'n') return run(() => ctx.createNewTab('about:blank', true));
      if (key === 'a') return run(() => toChrome('assistant:toggle'));
      if (key === 'b') return run(() => toChrome('bookmarks:toggle-bar'));
      if (key === 'r') return run(() => awc && awc.reloadIgnoringCache());
      if (key === 'tab') return run(() => cycle(-1));
      return;
    }
    if (key === 't') return run(() => ctx.createNewTab());
    if (key === 'w') return run(() => ctx.closeTab(ctx.getActiveId()));
    if (key === 'tab') return run(() => cycle(1));
    if (key === 'r') return run(() => awc && awc.reload());
    if (key === 'p') return run(() => awc && awc.print());
    if (key === 'u') return run(() => awc && ctx.createNewTab('view-source:' + awc.getURL()));
    if (key === 'h') return run(() => openInternal('kortex://history'));
    if (key === 'j') return run(() => openInternal('kortex://downloads'));
    if (key === 'l') return run(() => { toChrome('focus-url'); ctx.getChromeView().webContents.focus(); });
    if (key === 'f') return run(() => { toChrome('find:open'); ctx.getChromeView().webContents.focus(); });
    if (key === 'd') return run(() => { if (!awc) return; const r = toggleBookmark(awc.getURL(), awc.getTitle()); note(r.ok ? (r.bookmarked ? 'Marcador adicionado' : 'Marcador removido') : 'Esta página não pode ser guardada'); });
    if (/^[1-9]$/.test(key)) return run(() => { const ids = Object.keys(views()); const id = key === '9' ? ids[ids.length - 1] : ids[Number(key) - 1]; if (id) ctx.switchTab(id); });
  });
}

function setupFind() {
  ipcMain.on('find:start', (e, { text, forward = true, next = false } = {}) => { const v = active(); if (!v || !text) return; v.webContents.findInPage(String(text), { forward, findNext: next }); });
  ipcMain.on('find:stop', () => { const v = active(); if (v && !v.webContents.isDestroyed()) v.webContents.stopFindInPage('clearSelection'); });
}

function setupTabMenu() {
  ipcMain.on('tabs:context', (e, id) => {
    const v = views()[id]; if (!v) return;
    const wc = v.webContents;
    const others = () => Object.keys(views()).filter((x) => x !== id && !views()[x].pinned);
    const menu = Menu.buildFromTemplate([
      { label: 'Novo separador', click: () => ctx.createNewTab() },
      { type: 'separator' },
      { label: 'Recarregar', click: () => wc.reload() },
      { label: 'Duplicar', click: () => ctx.createNewTab(wc.getURL(), !!v.isPrivate) },
      { label: v.pinned ? 'Desafixar' : 'Fixar', click: () => { v.pinned = !v.pinned; ctx.sendTabsToUI(); } },
      { label: wc.isAudioMuted() ? 'Reativar som' : 'Silenciar separador', click: () => { wc.setAudioMuted(!wc.isAudioMuted()); ctx.sendTabsToUI(); } },
      { type: 'separator' },
      { label: 'Fechar', click: () => ctx.closeTab(id) },
      { label: 'Fechar outros', click: () => others().forEach((x) => ctx.closeTab(x)) },
      { label: 'Fechar à direita', click: () => { const ids = Object.keys(views()); ids.slice(ids.indexOf(id) + 1).filter((x) => !views()[x].pinned).forEach((x) => ctx.closeTab(x)); } }
    ]);
    menu.popup();
  });
}

function errorPage(url, desc) {
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const js = JSON.stringify(url).replace(/</g, '\\u003c');
  return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"><title>Não foi possível aceder ao site</title>
<style>body{margin:0;height:100vh;display:grid;place-items:center;background:#1a1b1d;color:#ececee;font-family:"Segoe UI",system-ui,sans-serif}
.b{max-width:480px;padding:24px}h1{font-size:22px;font-weight:600;margin-bottom:10px}p{color:#9a9aa2;line-height:1.5;margin-bottom:6px}
code{color:#ff5722}button{margin-top:18px;padding:10px 22px;border:0;border-radius:8px;background:#ff5722;color:#fff;font-size:14px;font-weight:600;cursor:pointer}</style></head>
<body><div class="b"><h1>Não foi possível aceder ao site</h1><p><code>${esc(url)}</code></p><p>${esc(desc)}</p>
<p>Verifica a ligação à internet e o endereço.</p><button onclick="location.href=${js}">Tentar de novo</button></div></body></html>`;
}

function attachView(id, view) {
  const wc = view.webContents;
  attach(wc);
  wc.on('page-favicon-updated', (e, favs) => { view.favicon = (favs && favs[0]) || ''; refresh(); });
  wc.on('did-start-loading', () => { view.loading = true; refresh(); });
  wc.on('did-stop-loading', () => { view.loading = false; refresh(); });
  wc.on('audio-state-changed', refresh);
  wc.on('did-navigate', (e, url) => { view.lastUrl = url; view.favicon = ''; if (!String(url).startsWith('data:')) view.failedUrl = ''; refresh(); });
  wc.on('did-navigate-in-page', (e, url, isMain) => { if (isMain) { view.lastUrl = url; refresh(); } });
  wc.on('found-in-page', (e, r) => { if (view === active()) toChrome('find:result', { active: r.activeMatchOrdinal, total: r.matches }); });
  wc.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 || code === 0) return;
    if (/^(kortex|view-source|data):/i.test(url)) return;
    view.failedUrl = url;
    wc.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(errorPage(url, desc)));
  });
}

function onClose(view) {
  const u = view && view.lastUrl;
  if (view && !view.isPrivate && /^(https?|kortex):/i.test(u || '')) {
    closed.push(u);
    if (closed.length > 20) closed.shift();
  }
}

function tabInfo(id, base) {
  const v = views()[id];
  if (!v) return base;
  let url = base.url;
  if (String(url).startsWith('data:text/html') && v.failedUrl) url = v.failedUrl;
  return { ...base, url, favicon: v.favicon || '', loading: !!v.loading, pinned: !!v.pinned, audible: v.webContents.isCurrentlyAudible(), muted: v.webContents.isAudioMuted() };
}

function init(c) {
  ctx = c; setupBookmarks(); setupHistory(); setupDownloads(); setupFind(); setupTabMenu(); setupPermissions(session.defaultSession);
}

const setupSession = (ses) => setupPermissions(ses);
const askAI = (text, opts = {}) => toChrome('assistant:ask', { text, ...opts });

module.exports = { init, attach, attachView, onClose, tabInfo, setupSession, askAI };