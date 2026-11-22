'use strict';
const { app, WebContentsView } = require('electron');

const OVERLAY_HTML = `<!doctype html><html><head><meta charset="utf-8">
<style>
html,body{margin:0;height:100%;font-family:system-ui,"Segoe UI",Roboto,sans-serif;background:#0f1012;color:#e8eaed;user-select:none;cursor:default}
body{display:flex;align-items:center;justify-content:center}
.card{width:min(460px,86vw);text-align:center}
.logo{font-size:46px;font-weight:700;color:#ff6a2b;margin-bottom:6px}
h1{font-size:20px;margin:6px 0 4px}
p{margin:6px 0;color:#9aa0a6;font-size:14px;line-height:1.5;word-break:break-word}
.bar{height:8px;border-radius:99px;background:#2a2c30;overflow:hidden;margin:20px 0 8px}
.bar>i{display:block;height:100%;width:0;background:#ff6a2b;transition:width .25s}
.bar.ind>i{width:35%;animation:ind 1.1s infinite ease-in-out}
@keyframes ind{0%{margin-left:-35%}100%{margin-left:100%}}
.btns{margin-top:18px;display:none;gap:10px;justify-content:center}
.btns a{padding:9px 20px;border-radius:99px;text-decoration:none;font-size:14px;background:#ff6a2b;color:#fff;cursor:pointer}
.btns a.sec{background:#2a2c30;color:#e8eaed}
</style></head><body><div class="card">
<div class="logo">K</div>
<h1 id="t">Atualização obrigatória</h1>
<p id="m"></p>
<div class="bar ind" id="b"><i id="p"></i></div>
<p id="s"></p>
<div class="btns" id="x"><a href="kortex-update://retry">Tentar novamente</a><a class="sec" href="kortex-update://quit">Sair</a></div>
</div>
<script>
window.__kx = function (s) {
  var g = function (id) { return document.getElementById(id); };
  g('t').textContent = s.title || '';
  g('m').textContent = s.message || '';
  g('s').textContent = s.detail || '';
  var b = g('b'), p = g('p');
  if (typeof s.percent === 'number') { b.className = 'bar'; p.style.width = s.percent + '%'; }
  else { b.className = 'bar ind'; p.style.width = ''; }
  b.style.display = s.hideBar ? 'none' : 'block';
  g('x').style.display = s.buttons ? 'flex' : 'none';
};
</script></body></html>`;

let updater = null;
let win = null;
let overlay = null;
let overlayReady = false;
let lastState = null;
let keepTopTimer = null;
let blocking = false;
let checking = false;
let downloading = false;
let pendingVersion = '';
let opts = {};

const log = (...a) => console.log('[updater]', ...a);
const mb = (n) => (n / 1048576).toFixed(1) + ' MB';

const ST = {
  checking: () => ({ title: 'A verificar atualização…', message: 'Um momento.', buttons: false }),
  downloading: (pct, detail) => ({
    title: 'Atualização obrigatória',
    message: 'A transferir a versão ' + pendingVersion + ' do Kortex. O navegador reinicia sozinho no fim.',
    percent: pct, detail: detail || '', buttons: false
  }),
  installing: () => ({
    title: 'A instalar…', message: 'O Kortex vai reiniciar já a seguir.', percent: 100, detail: '', buttons: false
  }),
  error: (msg) => ({
    title: 'Não foi possível atualizar',
    message: 'O Kortex precisa desta atualização para continuar.',
    detail: String(msg || '').slice(0, 220) + ' — verifica a ligação à internet e tenta de novo.',
    hideBar: true, buttons: true
  })
};

function setState(state) {
  lastState = state;
  if (!overlay || overlay.webContents.isDestroyed() || !overlayReady) return;
  overlay.webContents.executeJavaScript('window.__kx(' + JSON.stringify(state) + ')').catch(() => {});
}

function layout() {
  if (!overlay || !win || win.isDestroyed()) return;
  const b = win.getContentBounds();
  overlay.setBounds({ x: 0, y: 0, width: b.width, height: b.height });
}

function showOverlay() {
  if (overlay) return;
  win = typeof opts.getWindow === 'function' ? opts.getWindow() : null;
  if (!win || win.isDestroyed()) { setTimeout(showOverlay, 500); return; }

  overlay = new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  const wc = overlay.webContents;
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('will-navigate', (e, url) => {
    e.preventDefault();
    if (url === 'kortex-update://retry') retry();
    else if (url === 'kortex-update://quit') app.quit();
  });
  wc.on('did-finish-load', () => { overlayReady = true; if (lastState) setState(lastState); });

  win.contentView.addChildView(overlay);
  layout();
  win.on('resize', layout);
  win.on('enter-full-screen', layout);
  win.on('leave-full-screen', layout);
  wc.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(OVERLAY_HTML));
  wc.focus();

  keepTopTimer = setInterval(() => {
    if (!overlay || !win || win.isDestroyed() || overlay.webContents.isDestroyed()) return;
    try {
      const kids = win.contentView.children;
      if (kids[kids.length - 1] !== overlay) win.contentView.addChildView(overlay);
      if (!overlay.webContents.isFocused()) overlay.webContents.focus();
    } catch (e) {}
  }, 600);
}

function hideOverlay() {
  if (keepTopTimer) { clearInterval(keepTopTimer); keepTopTimer = null; }
  if (!overlay) return;
  try {
    if (win && !win.isDestroyed()) {
      win.removeListener('resize', layout);
      win.removeListener('enter-full-screen', layout);
      win.removeListener('leave-full-screen', layout);
      win.contentView.removeChildView(overlay);
    }
    if (!overlay.webContents.isDestroyed()) overlay.webContents.close();
  } catch (e) {}
  overlay = null; overlayReady = false; lastState = null;
}

async function check() {
  if (!updater || checking || downloading) return;
  checking = true;
  try { await updater.checkForUpdates(); } catch (e) {} finally { checking = false; }
}

function retry() {
  if (!blocking) return;
  downloading = false;
  setState(ST.checking());
  check();
}

function install() {
  try { if (typeof opts.onBeforeInstall === 'function') opts.onBeforeInstall(); } catch (e) {}
  updater.quitAndInstall(true, true);
  setTimeout(() => { try { app.exit(0); } catch (e) {} }, 8000);
}

function init(options = {}) {
  opts = Object.assign({ mandatory: true, intervalMs: 15 * 60 * 1000, firstCheckDelayMs: 2000 }, options);

  if (process.env.KORTEX_FAKE_UPDATE) return simulate();
  log('app isPackaged:', app.isPackaged);

  try { updater = require('electron-updater').autoUpdater; }
  catch (e) { console.warn('[updater] electron-updater nao esta instalado — atualizacoes desativadas'); return; }

  updater.allowPrerelease = false;
  updater.allowDowngrade = false;
  updater.logger = null;

  if (!opts.mandatory) {
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.on('error', (e) => log('erro:', e && e.message));
    setTimeout(check, opts.firstCheckDelayMs);
    setInterval(check, opts.intervalMs);
    return;
  }

  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;

  updater.on('update-available', (info) => {
    if (downloading) return;
    pendingVersion = info && info.version ? info.version : '';
    blocking = true; downloading = true;
    showOverlay();
    setState(ST.downloading(0, ''));
    log('nova versao', pendingVersion, '— a transferir');
    updater.downloadUpdate().catch(() => {});
  });

  updater.on('update-not-available', () => {
    if (blocking) { blocking = false; downloading = false; hideOverlay(); }
  });

  updater.on('download-progress', (p) => {
    const detail = mb(p.transferred) + ' / ' + mb(p.total) + '  ·  ' + mb(p.bytesPerSecond) + '/s';
    setState(ST.downloading(Math.round(p.percent), detail));
  });

  updater.on('update-downloaded', () => {
    downloading = false;
    setState(ST.installing());
    setTimeout(install, 1200);
  });

  updater.on('error', (err) => {
    log('erro:', err && err.message);
    downloading = false;
    if (blocking) setState(ST.error(err && err.message));
  });

  setTimeout(check, opts.firstCheckDelayMs);
  setInterval(() => { if (!blocking) check(); }, opts.intervalMs);
}

function checkNow() { return check(); }

function simulate() {
  setTimeout(() => {
    pendingVersion = '9.9.9';
    blocking = true;
    showOverlay();
    let pct = 0;
    setState(ST.downloading(0, '0.0 MB / 80.0 MB'));
    const t = setInterval(() => {
      pct += 4;
      if (pct >= 100) {
        clearInterval(t);
        setState(ST.installing());
        setTimeout(() => { blocking = false; hideOverlay(); }, 2500);
        return;
      }
      setState(ST.downloading(pct, mb(pct * 800000) + ' / 80.0 MB'));
    }, 150);
  }, 1500);
}

module.exports = { init, checkNow, isBlocking: () => blocking };