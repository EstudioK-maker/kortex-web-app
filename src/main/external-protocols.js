'use strict';
const { shell, dialog } = require('electron');

// Abrem direto, sem perguntar
const AUTO = ['roblox:', 'roblox-player:', 'roblox-studio:', 'roblox-studio-auth:', 'discord:', 'spotify:', 'steam:', 'tg:', 'whatsapp:', 'zoommtg:', 'zoomus:', 'com.epicgames.launcher:', 'epicgames:', 'minecraft:', 'slack:', 'msteams:', 'skype:', 'vscode:', 'mailto:', 'tel:'];
// Protocolos web/internos: nunca tratados como app externa
const WEB = /^(https?|file|about|data|blob|javascript|chrome|chrome-extension|devtools|view-source|kortex|ws|wss|ftp):/i;
// Protocolos do Windows usados em ataques: bloqueados sempre
const BLOCK = /^(ms-msdt|search-ms|search|ms-officecmd|ms-appinstaller):/i;

const recent = new Map();
let lastPrompt = 0;

function isExternal(url) {
  return typeof url === 'string' && /^[a-z][a-z0-9+.\-]*:/i.test(url) && !WEB.test(url);
}

async function launch(url) {
  const now = Date.now();
  if (recent.has(url) && now - recent.get(url) < 2000) return;
  recent.set(url, now);
  if (BLOCK.test(url)) { console.warn('[ext-proto] bloqueado:', url.slice(0, 120)); return; }
  console.log('[ext-proto] pedido:', url.slice(0, 160));
  if (!AUTO.some((p) => url.toLowerCase().startsWith(p))) {
    if (now - lastPrompt < 1500) return;
    lastPrompt = now;
    const scheme = url.split(':')[0];
    const r = await dialog.showMessageBox({ type: 'question', buttons: ['Abrir', 'Cancelar'], defaultId: 1, cancelId: 1, noLink: true, title: 'Kortex', message: 'Este site quer abrir uma aplicação externa (' + scheme + ':)', detail: url.slice(0, 300) });
    if (r.response !== 0) return;
  }
  try { await shell.openExternal(url); console.log('[ext-proto] aberto'); }
  catch (err) { console.error('[ext-proto] erro ao abrir:', err && err.message); }
}

function hook(wc) {
  const nav = (e, url) => {
    const u = (e && e.url) || url;
    if (isExternal(u)) { e.preventDefault(); launch(u); }
  };
  wc.on('will-navigate', nav);
  wc.on('will-redirect', nav);
  wc.on('will-frame-navigate', nav);
  wc.setWindowOpenHandler(({ url }) => {
    if (isExternal(url)) { launch(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
}

module.exports = { hook };