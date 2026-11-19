// src/main/browser-features.js â€” funcionalidades de navegador "a sÃ©rio" para o Kortex
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

// ... (Marcadores, HistÃ³rico, Downloads, PermissÃµes, etc. mantidos resumidos para o script caber) ...

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
function parseNetscapeBookmarks(html) {
  const out = [];
  const re = /<A[^>]*HREF="([^"]+)"[^>]*>([^<]*)<\/A>/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = m[1].trim();
    const title = (m[2] || '').trim() || url;
    if (/^https?:\/\//i.test(url)) out.push({ url, title });
  }
  return out;
}

function setupImports() {
  ipcMain.handle('import:bookmarks', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(ctx.getMainWindow(), {
      properties: ['openFile'], filters: [{ name: 'Favoritos (HTML)', extensions: ['html', 'htm'] }]
    });
    if (canceled || !filePaths[0]) return { success: false };
    try {
      const html = fs.readFileSync(filePaths[0], 'utf8');
      const imported = parseNetscapeBookmarks(html);
      const list = bm();
      let added = 0;
      for (const b of imported) {
        if (!list.find((x) => x.url === b.url)) {
          list.push({ id: crypto.randomUUID(), url: b.url, title: b.title, added: Date.now() });
          added++;
        }
      }
      writeJson('bookmarks.json', list);
      toChrome('bookmarks:changed');
      return { success: true, imported: added, total: imported.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

function setupBookmarks() {
  ipcMain.handle('bookmarks:list', () => bm());
  ipcMain.handle('bookmarks:is', (e, url) => bm().some((b) => b.url === url));
  ipcMain.handle('bookmarks:toggle', (e, { url, title } = {}) => toggleBookmark(url, title));
  ipcMain.handle('bookmarks:setFolder', (e, id, folder) => {
    const b = bm().find((x) => x.id === id); if (!b) return false;
    const name = String(folder || '').trim().slice(0, 40); if (name) b.folder = name; else delete b.folder;
    writeJson('bookmarks.json', bm()); toChrome('bookmarks:changed'); return true;
  });
  ipcMain.handle('bookmarks:remove', (e, id) => { bookmarks = bm().filter((b) => b.id !== id); writeJson('bookmarks.json', bookmarks); toChrome('bookmarks:changed'); return true; });
}

/* ---------------- HistÃ³rico ---------------- */
function setupHistory() {
  const read = () => { try { return JSON.parse(fs.readFileSync(ctx.historyPath, 'utf8')); } catch (e) { return []; } };
  ipcMain.handle('history:remove', (e, url) => { fs.writeFileSync(ctx.historyPath, JSON.stringify(read().filter((h) => h.url !== url))); toChrome('history:updated'); return true; });
  ipcMain.handle('history:clear', () => { fs.writeFileSync(ctx.historyPath, '[]'); toChrome('history:updated'); return true; });
}

/* ---------------- TransferÃªncias ---------------- */
const downloads = []; const dlItems = new Map();
function setupDownloads() {
  readJson('downloads.json', []).forEach((d) => downloads.push(d.state === 'progressing' ? { ...d, state: 'interrupted' } : d));
  session.defaultSession.on('will-download', (e, item) => {
    const filename = item.getFilename();
    const url = item.getURL();
    
    // Se for um ficheiro HTML/HTM, cancela o download e abre numa aba
    if (/\.(htm|html)$/i.test(filename) || /\.(htm|html)$/i.test(url)) {
        e.preventDefault();
        if (ctx && ctx.createNewTab) ctx.createNewTab(url);
        return;
    }
    
    const d = { id: crypto.randomUUID(), name: item.getFilename(), url: item.getURL(), total: item.getTotalBytes(), received: 0, state: 'progressing', path: '', date: Date.now() };
    downloads.unshift(d); dlItems.set(d.id, item); const push = () => toChrome('downloads:updated', d); push();
    item.on('updated', (_e, state) => { d.received = item.getReceivedBytes(); d.total = item.getTotalBytes(); d.state = state === 'interrupted' ? 'interrupted' : (item.isPaused() ? 'paused' : 'progressing'); d.path = item.getSavePath() || d.path; push(); });
    item.once('done', (_e, state) => { d.state = state; d.received = item.getReceivedBytes(); d.path = item.getSavePath() || d.path; dlItems.delete(d.id); writeJson('downloads.json', downloads.slice(0, 200)); push(); if (state === 'completed') note('Download concluÃ­do: ' + d.name); });
  });
  ipcMain.handle('downloads:list', () => downloads.slice(0, 200));
  ipcMain.handle('downloads:open', (e, id) => { const d = downloads.find((x) => x.id === id); if (d && d.path && fs.existsSync(d.path)) return shell.openPath(d.path); });
  ipcMain.handle('downloads:show', (e, id) => { const d = downloads.find((x) => x.id === id); if (d && d.path) shell.showItemInFolder(d.path); return true; });
  ipcMain.handle('downloads:pause', (e, id) => { const it = dlItems.get(id); const d = downloads.find((x) => x.id === id); if (it && d && !it.isPaused()) { it.pause(); d.state = 'paused'; toChrome('downloads:updated', d); } return true; });
  ipcMain.handle('downloads:resume', (e, id) => { const it = dlItems.get(id); const d = downloads.find((x) => x.id === id); if (it && d && it.canResume()) { it.resume(); d.state = 'progressing'; toChrome('downloads:updated', d); } return true; });
  ipcMain.handle('downloads:cancel', (e, id) => { const it = dlItems.get(id); if (it) it.cancel(); return true; });
  ipcMain.handle('downloads:clear', () => { for (let i = downloads.length - 1; i >= 0; i--) if (downloads[i].state !== 'progressing') downloads.splice(i, 1); writeJson('downloads.json', downloads); return true; });
}

/* ---------------- PermissÃµes ---------------- */
const AUTO_ALLOW = new Set(['fullscreen', 'clipboard-sanitized-write', 'pointerLock', 'keyboardLock', 'mediaKeySystem', 'media', 'display-capture']);
const ASK = new Set(['media', 'geolocation', 'notifications', 'midi', 'midiSysex', 'clipboard-read']);
let perms = null;
function describePermission(permission, details) {
  switch (permission) {
    case 'media': { const t = (details && details.mediaTypes) || []; return t.includes('video') && t.includes('audio') ? 'usar a cÃ¢mara e o microfone' : t.includes('video') ? 'usar a cÃ¢mara' : 'usar o microfone'; }
    case 'geolocation': return 'saber a tua localizaÃ§Ã£o'; case 'notifications': return 'enviar-te notificaÃ§Ãµes'; case 'display-capture': return 'partilhar o teu ecrÃ£'; case 'clipboard-read': return 'ler a Ã¡rea de transferÃªncia'; default: return 'usar a permissÃ£o "' + permission + '"';
  }
}
async function askPermission(origin, permission, details, k, store, persist) {
  let host = origin; try { host = new URL(origin).host; } catch (e) {}
  const r = await dialog.showMessageBox({ type: 'question', buttons: ['Permitir', 'Bloquear'], defaultId: 1, cancelId: 1, title: 'Pedido de permissÃ£o', message: `${host} quer ${describePermission(permission, details)}`, checkboxLabel: persist ? 'Lembrar a minha escolha para este site' : 'Lembrar nesta sessÃ£o privada', checkboxChecked: persist });
  const allowed = r.response === 0; if (r.checkboxChecked) { store[k] = allowed; if (persist) writeJson('permissions.json', store); } return allowed;
}
function setupPermissions(ses, { persist = true } = {}) {
  const store = persist ? (perms = perms || readJson('permissions.json', {})) : {};
  const pendingHere = new Map(); const key = (origin, p) => origin + '|' + p;
  ses.setPermissionCheckHandler((wc, permission, origin) => AUTO_ALLOW.has(permission) || store[key(origin, permission)] === true);
  ses.setPermissionRequestHandler(async (wc, permission, callback, details) => {
    if (AUTO_ALLOW.has(permission)) return callback(true); if (!ASK.has(permission)) return callback(false);
    let origin = ''; try { origin = new URL(details.requestingUrl || wc.getURL()).origin; } catch (e) {}
    if (!origin || origin === 'null') return callback(false);
    const k = key(origin, permission); if (k in store) return callback(store[k]); if (pendingHere.has(k)) return pendingHere.get(k).then(callback);
    const p = askPermission(origin, permission, details, k, store, persist); pendingHere.set(k, p); let allowed = false;
    try { allowed = await p; } finally { pendingHere.delete(k); } callback(allowed);
  });
}
function setupPermissionsIpc() {
  perms = perms || readJson('permissions.json', {});
  ipcMain.handle('permissions:list', () => Object.keys(perms).map((k) => { const i = k.lastIndexOf('|'); const permission = k.slice(i + 1); const label = permission === 'media' ? 'usar a cÃ¢mara ou o microfone' : describePermission(permission, {}); return { key: k, origin: k.slice(0, i), permission, label, allowed: perms[k] === true }; }));
  ipcMain.handle('permissions:remove', (e, k) => { if (k in perms) { delete perms[k]; writeJson('permissions.json', perms); } return true; });
  ipcMain.handle('permissions:clear', () => { Object.keys(perms).forEach((k) => delete perms[k]); writeJson('permissions.json', perms); return true; });
}

/* ---------------- Partilha de ecrÃ£ ---------------- */
const THUMB_SIZE = { width: 320, height: 200 };
function pickerHtml(items) {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cards = items.map((it) => `<div class="card" data-i="${it.i}" tabindex="0" role="button" aria-label="${esc(it.name)}">` + (it.thumb ? `<img class="pic" src="${it.thumb}" alt="">` : `<div class="ph">PrÃ©-visualizaÃ§Ã£o indisponÃ­vel</div>`) + `<div class="meta">${it.icon ? `<img class="icon" src="${it.icon}" alt="">` : ''}<span>${esc(it.name)}</span></div><div class="kind">${it.kind === 'screen' ? 'EcrÃ£ inteiro' : 'Janela'}</div></div>`).join('');
  return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"><title>Partilhar o ecrÃ£</title><style>body{margin:0;background:#141517;color:#ececee;font-family:"Segoe UI",system-ui,sans-serif;user-select:none}header{padding:18px 22px 6px}h1{font-size:17px;font-weight:600;margin:0 0 4px}header p{margin:0;font-size:12px;color:#9a9aa2}#grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;padding:14px 22px 6px}.card{background:#1f2023;border:1px solid #2c2d31;border-radius:10px;overflow:hidden;cursor:pointer;transition:border-color .15s}.card:hover,.card:focus{border-color:#ff5722;outline:none}.card .pic{display:block;width:100%;height:168px;object-fit:cover;background:#0c0d0e}.ph{height:168px;background:#0c0d0e;display:grid;place-items:center;color:#55565b;font-size:12px}.meta{display:flex;align-items:center;gap:8px;padding:8px 12px 0}.meta .icon{width:16px;height:16px;border-radius:3px;flex:none}.meta span{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kind{font-size:11px;color:#8a8b90;padding:2px 12px 10px}footer{display:flex;justify-content:flex-end;padding:10px 22px 18px}button{background:#2c2d31;color:#ececee;border:0;border-radius:8px;padding:9px 18px;font-size:13px;cursor:pointer}button:hover{background:#38393d}</style></head><body><header><h1>Escolher o que partilhar</h1><p>Seleciona um ecrÃ£ inteiro ou uma janela â€” a partilha comeÃ§a de imediato.</p></header><div id="grid">${cards}</div><footer><button id="cancel">Cancelar</button></footer><script>var done=false,resolver=null;window.__pickPromise=new Promise(function(r){resolver=r;});function finish(v){if(done)return;done=true;resolver(v);}document.querySelectorAll('.card').forEach(function(c){c.addEventListener('click',function(){finish(parseInt(c.dataset.i,10));});c.addEventListener('keydown',function(e){if(e.key==='Enter')finish(parseInt(c.dataset.i,10));});});document.getElementById('cancel').addEventListener('click',function(){finish(null);});document.addEventListener('keydown',function(e){if(e.key==='Escape')finish(null);});setTimeout(function(){finish(null);},120000);</script></body></html>`;
}
async function pickDisplaySource() {
  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: THUMB_SIZE, fetchWindowIcons: true }); if (!sources.length) return null;
  const items = sources.map((s, i) => ({ i, name: s.name || (String(s.id).startsWith('screen:') ? 'EcrÃ£ ' + (i + 1) : 'Janela'), kind: String(s.id).startsWith('screen:') ? 'screen' : 'window', thumb: s.thumbnail && !s.thumbnail.isEmpty() ? s.thumbnail.toDataURL() : '', icon: s.appIcon && !s.appIcon.isEmpty() ? s.appIcon.toDataURL() : '' }));
  const mw = ctx && ctx.getMainWindow ? ctx.getMainWindow() : null;
  const win = new BrowserWindow({ width: 760, height: 540, ...(mw && !mw.isDestroyed() ? { parent: mw, modal: true } : {}), frame: false, resizable: false, minimizable: false, maximizable: false, fullscreenable: false, alwaysOnTop: true, show: false, backgroundColor: '#141517', title: 'Partilhar o ecrÃ£', autoHideMenuBar: true, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false } });
  win.once('ready-to-show', () => win.show());
  try { await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(pickerHtml(items))); const choice = await win.webContents.executeJavaScript('window.__pickPromise', true); return Number.isInteger(choice) && sources[choice] ? sources[choice] : null; } catch (e) { return null; } finally { try { if (!win.isDestroyed()) win.destroy(); } catch (e2) {} }
}
function attachDisplayMediaHandler(ses) {
  try {
    ses.setDisplayMediaRequestHandler(async (request, callback) => {
      if (!request || request.videoRequested === false) return callback({}); if (!request.userGesture) return callback({});
      try { const source = await pickDisplaySource(); if (!source) return callback({}); const out = { video: source }; if (request.audioRequested && process.platform === 'win32') out.audio = 'loopback'; callback(out); } catch (e) { callback({}); }
    });
  } catch (e) {}
}

/* ---------------- Certificados ---------------- */
const certExceptions = new Set();
function setupCertificates() {
  app.on('certificate-error', (event, wc, url, error, certificate, callback) => { event.preventDefault(); let host = ''; try { host = new URL(url).host; } catch (e) {} callback(!!host && certExceptions.has(host)); });
  ipcMain.handle('security:proceed', (e, url) => { const view = Object.values(views()).find((v) => v.webContents === e.sender); if (!view || !view.failedUrl || view.failedUrl !== url) return false; let u; try { u = new URL(url); } catch (e2) { return false; } if (u.protocol !== 'https:') return false; certExceptions.add(u.host); view.webContents.loadURL(url); return true; });
}

/* ---------------- Atalhos ---------------- */
const closed = [];
function zoom(delta, reset) { const v = active(); if (!v) return; const wc = v.webContents; const z = reset ? 1 : Math.min(3, Math.max(0.25, +(wc.getZoomFactor() + delta).toFixed(2))); wc.setZoomFactor(z); note('Zoom: ' + Math.round(z * 100) + '%'); }
function cycle(dir) { const ids = Object.keys(views()); if (ids.length < 2) return; const i = ids.indexOf(ctx.getActiveId()); ctx.switchTab(ids[(i + dir + ids.length) % ids.length]); }
function openInternal(url) { const v = active(); const cur = v ? v.webContents.getURL() : ''; if (v && (cur === '' || cur === 'about:blank')) v.webContents.loadURL(url); else ctx.createNewTab(url); }
function reopenClosed() { const u = closed.pop(); if (u) ctx.createNewTab(u); }

function attach(wc) {
  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const ctrl = input.control || input.meta; const key = (input.key || '').toLowerCase();
    const run = (fn) => { event.preventDefault(); try { fn(); } catch (e) {} };
    const v = active(); const awc = v && v.webContents;

    if (key === 'escape') { toChrome('find:close'); return; }
    if (key === 'f12' || (ctrl && input.shift && key === 'i')) return run(() => awc && awc.toggleDevTools());
    if (key === 'f11') return run(() => { const w = ctx.getMainWindow(); w.setFullScreen(!w.isFullScreen()); });
    if (key === 'f5') return run(() => awc && awc.reload());
    if (input.alt && !ctrl && (key === 'arrowleft' || key === 'arrowright')) { return run(() => { if (!awc) return; const h = navOf(awc); if (key === 'arrowleft') { if (h.canGoBack()) h.goBack(); } else if (h.canGoForward()) h.goForward(); }); }
    if (!ctrl) return;

    if (key === '+' || key === '=') return run(() => zoom(0.1));
    if (key === '-') return run(() => zoom(-0.1));
    if (key === '0') return run(() => zoom(0, true));

    if (input.shift) {
      if (key === 't') return run(reopenClosed);
      if (key === 'g') return run(() => require('./google-accounts').openPopup());
      if (key === 'n') return run(() => ctx.createNewTab('about:blank', true));
      if (key === 'a') return run(() => toChrome('assistant:toggle'));
      if (key === 'k') return run(() => { toChrome('tabsearch:open'); ctx.getChromeView().webContents.focus(); });
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
    if (key === 'd') return run(() => { if (!awc) return; const r = toggleBookmark(awc.getURL(), awc.getTitle()); note(r.ok ? (r.bookmarked ? 'Marcador adicionado' : 'Marcador removido') : 'Esta pÃ¡gina nÃ£o pode ser guardada'); });
    if (/^[1-9]$/.test(key)) return run(() => { const ids = Object.keys(views()); const id = key === '9' ? ids[ids.length - 1] : ids[Number(key) - 1]; if (id) ctx.switchTab(id); });
  });
}

/* ---------------- Pesquisa ---------------- */
function setupFind() {
  ipcMain.on('find:start', (e, { text, forward = true, next = false } = {}) => { const v = active(); if (!v || !text) return; v.webContents.findInPage(String(text), { forward, findNext: next }); });
  ipcMain.on('find:stop', () => { const v = active(); if (v && !v.webContents.isDestroyed()) v.webContents.stopFindInPage('clearSelection'); });
}

/* ---------------- Menu de contexto ---------------- */
function setupTabMenu() {
  ipcMain.on('tabs:context', (e, id) => {
    const v = views()[id]; if (!v) return; const wc = v.webContents;
    const others = () => Object.keys(views()).filter((x) => x !== id && !views()[x].pinned);
    const menu = Menu.buildFromTemplate([
      { label: 'Novo separador', click: () => ctx.createNewTab() },
      { label: 'Reabrir separador fechado', enabled: closed.length > 0, click: reopenClosed },
      { type: 'separator' },
      { label: 'Recarregar', click: () => wc.reload() },
      { label: 'Duplicar', click: () => ctx.createNewTab(wc.getURL(), !!v.isPrivate) },
      { label: v.pinned ? 'Desafixar' : 'Fixar', click: () => { v.pinned = !v.pinned; ctx.sendTabsToUI(); } },
      { label: wc.isAudioMuted() ? 'Reativar som' : 'Silenciar separador', click: () => { wc.setAudioMuted(!wc.isAudioMuted()); ctx.sendTabsToUI(); } },
      { type: 'separator' },
      { label: 'Fechar', click: () => ctx.closeTab(id) },
      { label: 'Fechar outros', click: () => others().forEach((x) => ctx.closeTab(x)) },
      { label: 'Fechar Ã  direita', click: () => { const ids = Object.keys(views()); ids.slice(ids.indexOf(id) + 1).filter((x) => !views()[x].pinned).forEach((x) => ctx.closeTab(x)); } }
    ]);
    menu.popup();
  });
}

/* ---------------- PÃ¡gina de erro ---------------- */
function errorPage(url, desc) {
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const js = JSON.stringify(url).replace(/</g, '\\u003c');
  return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"><title>NÃ£o foi possÃ­vel aceder ao site</title><style>body{margin:0;height:100vh;display:grid;place-items:center;background:#1a1b1d;color:#ececee;font-family:"Segoe UI",system-ui,sans-serif}.b{max-width:480px;padding:24px}h1{font-size:22px;font-weight:600;margin-bottom:10px}p{color:#9a9aa2;line-height:1.5;margin-bottom:6px}code{color:#ff5722}button{margin-top:18px;padding:10px 22px;border:0;border-radius:8px;background:#ff5722;color:#fff;font-size:14px;font-weight:600;cursor:pointer}</style></head><body><div class="b"><h1>NÃ£o foi possÃ­vel aceder ao site</h1><p><code>${esc(url)}</code></p><p>${esc(desc)}</p><p>Verifica a ligaÃ§Ã£o Ã  internet e o endereÃ§o.</p><button onclick="location.href=${js}">Tentar de novo</button></div></body></html>`;
}

const DARK_CSS = 'html{background:#fff!important;filter:invert(1) hue-rotate(180deg)!important}' + 'img,picture,video,canvas,iframe,[style*="background-image"]{filter:invert(1) hue-rotate(180deg)!important}';
async function applyDark(view) {
  const wc = view.webContents; if (wc.isDestroyed()) return;
  if (view.darkKey) { try { await wc.removeInsertedCSS(view.darkKey); } catch (e) {} view.darkKey = null; }
  const want = false; if (want) { try { view.darkKey = await wc.insertCSS(DARK_CSS); } catch (e) {} }
}

function showPageMenu(view, p) {
  const wc = view.webContents; const nav = navOf(wc); const sel = (p.selectionText || '').trim(); const t = []; const sep = () => { if (t.length && t[t.length - 1].type !== 'separator') t.push({ type: 'separator' }); };
  if (p.isEditable) { const f = p.editFlags || {}; t.push({ label: 'Anular', enabled: !!f.canUndo, click: () => wc.undo() }, { label: 'Refazer', enabled: !!f.canRedo, click: () => wc.redo() }, { type: 'separator' }, { label: 'Cortar', enabled: !!f.canCut, click: () => wc.cut() }, { label: 'Copiar', enabled: !!f.canCopy, click: () => wc.copy() }, { label: 'Colar', enabled: !!f.canPaste, click: () => wc.paste() }, { label: 'Selecionar tudo', click: () => wc.selectAll() }); }
  if (sel && !p.isEditable) { const short = sel.length > 28 ? sel.slice(0, 28) + 'â€¦' : sel; t.push({ label: 'Copiar', click: () => wc.copy() }); t.push({ label: `Pesquisar Â«${short}Â»`, click: () => ctx.createNewTab(ctx.settings.searchUrl(sel)) }); }
  if (sel) t.push({ label: 'Perguntar ao Kortex', click: () => askAI('Explica isto:\n\n' + sel) });
  if (p.linkURL) { sep(); t.push({ label: 'Abrir ligaÃ§Ã£o num novo separador', click: () => ctx.createNewTab(p.linkURL) }, { label: 'Copiar endereÃ§o da ligaÃ§Ã£o', click: () => clipboard.writeText(p.linkURL) }); }
  if (p.mediaType === 'image' && p.srcURL) { sep(); t.push({ label: 'Abrir imagem num novo separador', click: () => ctx.createNewTab(p.srcURL) }, { label: 'Guardar imagem comoâ€¦', click: () => wc.downloadURL(p.srcURL) }, { label: 'Copiar imagem', click: () => wc.copyImageAt(p.x, p.y) }, { label: 'Copiar endereÃ§o da imagem', click: () => clipboard.writeText(p.srcURL) }); }
  if (!p.isEditable && !sel && !p.linkURL && p.mediaType !== 'image') { t.push({ label: 'Recuar', enabled: nav.canGoBack(), click: () => nav.goBack() }, { label: 'AvanÃ§ar', enabled: nav.canGoForward(), click: () => nav.goForward() }, { label: 'Recarregar', click: () => wc.reload() }, { type: 'separator' }, { label: 'Resumir esta pÃ¡gina', click: () => askAI('Resume esta pÃ¡gina em pontos principais.') }, { label: 'Perguntar ao Kortex sobre esta pÃ¡gina', click: () => askAI('') }, { type: 'separator' }, { label: 'Guardar pÃ¡gina comoâ€¦', click: () => wc.downloadURL(wc.getURL()) }, { label: 'Imprimirâ€¦', click: () => wc.print() }, { label: 'Traduzir esta pÃ¡gina', click: () => ctx.createNewTab('https://translate.google.com/translate?sl=auto&tl=pt&u=' + encodeURIComponent(wc.getURL())) }, { label: 'Ver cÃ³digo-fonte', click: () => ctx.createNewTab('view-source:' + wc.getURL()) }); }
  sep(); t.push({ label: 'Inspecionar', click: () => wc.inspectElement(p.x, p.y) });
  const menu = Menu.buildFromTemplate(t);
  try { menu.popup({ window: ctx.getMainWindow() }); } catch (e) { menu.popup(); }
}

/* ---------------- LigaÃ§Ãµes por separador ---------------- */
function attachView(id, view) {
  const wc = view.webContents;
  attach(wc);

  wc.on('page-favicon-updated', (e, favs) => { view.favicon = (favs && favs[0]) || ''; refresh(); });
  wc.on('did-start-loading', () => { view.loading = true; refresh(); });
  wc.on('did-stop-loading', () => { view.loading = false; refresh(); });
  wc.on('audio-state-changed', refresh);
  
  // AQUI ESTÃ A INJEÃ‡ÃƒO DO CLAUDE
  wc.on('dom-ready', () => {
    applyDark(view);
    applyContrastFix(wc);
    gmailTheme.apply(wc);
    gmailTheme.apply(wc);
  });

  wc.on('context-menu', (e, params) => showPageMenu(view, params));
  wc.on('will-navigate', (e, url) => {
      if (url.startsWith('kortex://google-accounts')) {
        e.preventDefault();
        if (ctx && ctx.openGoogleAccounts) ctx.openGoogleAccounts(wc);
      }
    });

    wc.on('did-navigate', (e, url) => {
    gmailTheme.apply(wc);
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
  if (view && !view.isPrivate && /^(https?|kortex):/i.test(u || '')) { closed.push(u); if (closed.length > 20) closed.shift(); }
}

function tabInfo(id, base) {
  const v = views()[id]; if (!v) return base;
  let url = base.url;
  const onErrorPage = /^(data:text\/html|kortex:\/\/certerror)/i.test(String(url));
  if (onErrorPage && v.failedUrl) url = v.failedUrl;
  return { ...base, url, certError: onErrorPage && /^kortex:\/\/certerror/i.test(String(base.url)), favicon: v.favicon || '', loading: !!v.loading, pinned: !!v.pinned, audible: v.webContents.isCurrentlyAudible(), muted: v.webContents.isAudioMuted() };
}

function init(c) {
  ctx = c;
  setupBookmarks(); setupHistory(); setupDownloads(); setupFind(); setupTabMenu();
  setupPermissions(session.defaultSession);
  attachDisplayMediaHandler(session.defaultSession);
  setupPermissionsIpc(); setupCertificates();
  if (ctx.settings) ctx.settings.onChanged((key) => { if (key === 'appearance.forceDark') Object.values(views()).forEach(applyDark); });
}

const setupSession = (ses) => { setupPermissions(ses, { persist: false }); attachDisplayMediaHandler(ses); };

module.exports = { init, attach, attachView, onClose, tabInfo, setupSession, askAI, openInternal };



