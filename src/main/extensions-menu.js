// src/main/extensions-menu.js — popup do botão de extensões.
const path = require('path');
const fs = require('fs');
const { ipcMain, BrowserWindow, WebContentsView, screen, session } = require('electron');

const WIDTH = 360; 
const MAX_H = 500;
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

let ctx = null;
let view = null;
let visible = false;
let hiddenAt = 0;
let lastRect = null;
let popupWin = null;

const actionOf = (manifest) => (manifest && (manifest.action || manifest.browser_action || manifest.page_action)) || {};

function popupOf(ex) {
  const p = actionOf(ex.manifest).default_popup;
  return typeof p === 'string' ? p.replace(/^\/+/, '') : '';
}

function displayName(ex) {
  const n = String(ex.name || '').trim();
  return !n || /^__MSG_/.test(n) ? path.basename(ex.path || 'Extensão') : n;
}

function iconOf(ex) {
  const m = ex.manifest || {};
  const found = [];
  const add = (v) => {
    if (typeof v === 'string') found.push([48, v]);
    else if (v && typeof v === 'object') Object.entries(v).forEach(([size, p]) => { if (typeof p === 'string') found.push([parseInt(size, 10) || 0, p]); });
  };
  add(actionOf(m).default_icon);
  add(m.icons);
  found.sort((a, b) => Math.abs(a[0] - 48) - Math.abs(b[0] - 48));

  const root = path.resolve(ex.path);
  for (const [, rel] of found) {
    const file = path.resolve(root, rel.replace(/^\/+/, ''));
    const mime = MIME[path.extname(file).toLowerCase()];
    if (!mime || !file.startsWith(root + path.sep)) continue;
    try {
      if (fs.statSync(file).size > 300 * 1024) continue;
      return `data:${mime};base64,` + fs.readFileSync(file).toString('base64');
    } catch (e) {}
  }
  return '';
}

function list() {
  const all = session.defaultSession.extensions.getAllExtensions().filter((ex) => !ctx.isDisabled(ex.path));
  const fullAccess = [];
  const limitedAccess = [];
  const noAccess = [];

  all.forEach((ex) => {
    const manifest = ex.manifest || {};
    const perms = manifest.host_permissions || [];
    const hasAllUrls = perms.some(p => p === '<all_urls>' || p === '*://*/*' || p === 'http://*/*' || p === 'https://*/*');
    
    const item = { id: ex.id, name: displayName(ex), version: ex.version || '', icon: iconOf(ex), hasPopup: !!popupOf(ex) };
    if (hasAllUrls) fullAccess.push(item);
    else if (perms.length > 0) limitedAccess.push(item);
    else noAccess.push(item);
  });

  const sortByName = (a, b) => a.name.localeCompare(b.name, 'pt');
  fullAccess.sort(sortByName);
  limitedAccess.sort(sortByName);
  noAccess.sort(sortByName);

  return {
    groups: [
      { title: 'Acesso completo', desc: 'Estas extensões podem ver e alterar as informações neste site.', items: fullAccess },
      { title: 'Acesso limitado', desc: 'Estas extensões podem ver e alterar informações em sites específicos.', items: limitedAccess },
      { title: 'Não é necessário acesso', desc: 'Estas extensões não precisam de ver nem de alterar informações neste site.', items: noAccess }
    ].filter(g => g.items.length > 0)
  };
}

function hide() {
  visible = false;
  if (view && !view.webContents.isDestroyed()) view.setVisible(false);
}

function show(rect) {
  const data = list();
  const groupsCount = data.groups.length;
  const itemsCount = data.groups.reduce((acc, g) => acc + g.items.length, 0);
  
  let finalHeight = 120 + (groupsCount * 82) + (itemsCount * 40);
  finalHeight = Math.min(Math.max(finalHeight, 160), MAX_H);

  view.setBounds({
    x: Math.max(8, Math.round(rect.x + rect.width - WIDTH)),
    y: Math.round(rect.y + rect.height + 6),
    width: WIDTH,
    height: finalHeight
  });
  
  ctx.raise();
  view.webContents.send('extmenu:render', data);
  view.setVisible(true);
  view.webContents.focus();
  visible = true;
}

function openPopup(id) {
  hide();
  const ex = session.defaultSession.extensions.getExtension(id);
  if (!ex || ctx.isDisabled(ex.path)) return false;
  const popup = popupOf(ex);
  if (!popup) { ctx.toast(`"${displayName(ex)}" não tem menu para abrir.`); return false; }

  if (popupWin && !popupWin.isDestroyed()) popupWin.close();
  
  const win = ctx.getMainWindow();
  // Obtém o tamanho da janela principal para calcular os limites
  const content = win.getContentBounds();
  // Obtém a área útil do ecrã (sem a barra de tarefas)
  const area = screen.getDisplayMatching(win.getBounds()).workArea;
  
  // Coordenadas do botão das extensões
  const btnX = lastRect ? lastRect.x + lastRect.width : content.width - 16;
  const btnY = lastRect ? lastRect.y + lastRect.height : 80;

  // Cria a janela escondida
  popupWin = new BrowserWindow({
    width: 10, height: 10, x: 0, y: 0, frame: false, resizable: false, show: false, alwaysOnTop: true, skipTaskbar: true,
    backgroundColor: '#1a1b1d',
    webPreferences: { session: session.defaultSession, nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  
  const w = popupWin;
  w.loadURL(`chrome-extension://${ex.id}/${popup}`);
  w.on('blur', () => { if (!w.isDestroyed()) w.close(); });
  
  w.webContents.on('did-finish-load', () => {
    setTimeout(async () => {
      if (w.isDestroyed()) return;
      try {
        const size = await w.webContents.executeJavaScript('({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight })');
        
        const cw = Math.min(800, Math.max(200, Math.ceil(size.w)));
        const ch = Math.min(600, Math.max(100, Math.ceil(size.h)));

        w.setContentSize(cw, ch);
        
        // Alinhamento perfeito: o canto direito do popup alinha com o canto direito do botão.
        // O topo do popup fica 6px abaixo do fundo do botão.
        let targetX = btnX - cw;
        let targetY = btnY + 6;

        // Se sair do ecrã pela esquerda, empurra para a direita (margem de 8px)
        if (targetX < area.x + 8) targetX = area.x + 8;
        // Se sair do ecrã pela direita, puxa para a esquerda
        if (targetX + cw > area.x + area.width) targetX = area.x + area.width - cw - 8;

        // Se sair do ecrã por baixo, tenta abrir para cima
        if (targetY + ch > area.y + area.height) {
           targetY = btnY - ch - 6;
        }

        // Posiciona
        w.setPosition(Math.round(targetX), Math.round(targetY));
        w.show();
        
      } catch (e) {
        w.show();
      }
    }, 150);
  });
  return true;
}

function validRect(r) {
  return r && ['x', 'y', 'width', 'height'].every((k) => Number.isFinite(r[k]));
}

function create(context, preload, htmlFile) {
  ctx = context;
  view = new WebContentsView({ webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: false } });
  view.setBackgroundColor('#00000000');
  view.setVisible(false);
  view.webContents.loadFile(htmlFile);
  view.webContents.on('blur', () => { if (visible) { hide(); hiddenAt = Date.now(); } });

  ipcMain.on('extmenu:toggle', (e, rect) => {
    if (e.sender !== ctx.getChromeView().webContents || !validRect(rect)) return;
    if (visible) { hide(); return; }
    if (Date.now() - hiddenAt < 250) return;
    lastRect = rect;
    show(rect);
  });
  ipcMain.on('extmenu:open', (e, id) => { if (e.sender === view.webContents && typeof id === 'string') openPopup(id); });
  ipcMain.on('extmenu:manage', (e) => { if (e.sender === view.webContents) { hide(); ctx.navigateActive('kortex://extensions'); } });
  ipcMain.on('extmenu:store', (e) => { if (e.sender === view.webContents) { hide(); ctx.navigateActive('kortex://store'); } });
  ipcMain.on('extmenu:close', (e) => { if (e.sender === view.webContents) hide(); });
  return view;
}

module.exports = { create, hide, openPopup, popupOf, iconOf };
