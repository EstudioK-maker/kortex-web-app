const { app, ipcMain } = require('electron');
let iniciado = false;
let pronto = false;
let erro = null;
function componentesDisponiveis() { try { const { components } = require('electron'); return !!(components && typeof components.start === 'function'); } catch (e) { return false; } }
function start() {
  if (iniciado) return;
  iniciado = true;
  try {
    const { components } = require('electron');
    if (!components || typeof components.start !== 'function') { erro = 'sem-castlabs'; console.warn('[Kortex] DRM: este Electron não inclui Widevine — troca o pacote "electron" pelo fork do castLabs.'); return; }
    components.start();
    console.log('[Kortex] DRM: componente Widevine a iniciar');
    if (components.whenReady) { components.whenReady().then(() => { pronto = true; erro = null; console.log('[Kortex] DRM: Widevine CDM pronto (Netflix/Spotify desbloqueados)'); }).catch((e) => { erro = (e && e.message) || String(e); console.error('[Kortex] DRM:', erro); }); }
  } catch (e) { erro = (e && e.message) || String(e); console.error('[Kortex] DRM:', erro); }
}
function init() {
  ipcMain.handle('widevine:status', () => ({ disponivel: componentesDisponiveis(), pronto, erro }));
  app.whenReady().then(() => start()).catch(() => {});
}
module.exports = { init };