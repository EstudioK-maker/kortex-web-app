const { app, session, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

const ID_RE = /^[a-p]{32}$/;
const DETAIL_RE = /\/detail\/(?:[^/]+\/)?([a-p]{32})(?:[/?#]|$)/;
const STORE_URL = /^https:\/\/chromewebstore\.google\.com\//;
const busy = new Set();
let ctx = {};

function parseId(input) {
  const s = String(input || '').trim();
  if (ID_RE.test(s)) return s;
  try { const m = DETAIL_RE.exec(new URL(s).pathname); if (m) return m[1]; } catch {}
  const m = DETAIL_RE.exec(s);
  return m ? m[1] : null;
}

function crxToZip(buf) {
  if (buf.length > 16 && buf.toString('latin1', 0, 4) === 'Cr24') {
    const ver = buf.readUInt32LE(4);
    if (ver === 3) return buf.subarray(12 + buf.readUInt32LE(8));
    if (ver === 2) return buf.subarray(16 + buf.readUInt32LE(8) + buf.readUInt32LE(12));
    throw new Error('Versao de CRX desconhecida: ' + ver);
  }
  if (buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4B) return buf;
  throw new Error('O ficheiro descarregado nao e uma extensao valida.');
}

async function download(id) {
  const prod = process.versions.chrome || '120.0.0.0';
  const url = 'https://clients2.google.com/service/update2/crx?response=redirect&os=win&arch=x64&os_arch=x86_64&nacl_arch=x86-64&prod=chromecrx&prodchannel=&prodversion=' +
    prod + '&lang=pt-PT&acceptformat=crx2,crx3&x=' + encodeURIComponent('id=' + id + '&installsource=ondemand&uc');
  const res = await fetch(url, { redirect: 'follow' });
  if (res.status === 204 || res.status === 404) throw new Error('Esta extensao nao esta disponivel para download (foi removida da loja ou e restrita).');
  if (!res.ok) throw new Error('Falha ao descarregar da Google (HTTP ' + res.status + ').');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) throw new Error('A loja devolveu uma resposta vazia.');
  return buf;
}

function extract(zipBuf, dir) {
  const zip = new AdmZip(zipBuf);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const root = path.resolve(dir) + path.sep;
  for (const e of zip.getEntries()) {
    const name = e.entryName.replace(/\\/g, '/');
    if (e.isDirectory || name.startsWith('_metadata/')) continue;
    const dest = path.resolve(dir, name);
    if (!dest.startsWith(root)) throw new Error('Ficheiro suspeito dentro da extensao: ' + name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, e.getData());
  }
}

function saveRegistry(dir) {
  const file = path.join(app.getPath('userData'), 'extensions.json');
  let list = [];
  try { list = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  if (!Array.isArray(list)) list = [];
  if (!list.includes(dir)) { list.push(dir); try { fs.writeFileSync(file, JSON.stringify(list)); } catch {} }
  if (ctx.registerExtension) ctx.registerExtension(dir);
}

async function install(input) {
  const id = parseId(input);
  if (!id) return { success: false, error: 'Link ou ID invalido. Cola o link da pagina da extensao na Chrome Web Store.' };
  if (busy.has(id)) return { success: false, error: 'Esta extensao ja esta a ser instalada.' };
  busy.add(id);
  try {
    const dir = path.join(app.getPath('userData'), 'extensions', id);
    const ses = session.defaultSession;
    const zip = crxToZip(await download(id));
    const norm = (p) => path.normalize(p).toLowerCase();
    const old = ses.extensions.getAllExtensions().find((x) => norm(x.path) === norm(dir));
    if (old) { try { ses.extensions.removeExtension(old.id); } catch {} }
    extract(zip, dir);
    const loaded = await ses.extensions.loadExtension(dir, { allowFileAccess: true });
    saveRegistry(dir);
    return { success: true, id: loaded.id, name: loaded.name };
  } catch (e) {
    let msg = e && e.message ? e.message : String(e);
    if (/manifest/i.test(msg)) msg += ' (extensoes Manifest V2 ja nao sao suportadas pelo motor atual)';
    return { success: false, error: msg };
  } finally { busy.delete(id); }
}

const STORE_SCRIPT = String.raw`(function () {
  if (window.__kortexStoreInit) return;
  window.__kortexStoreInit = true;
  var RE = /\/detail\/(?:[^\/]+\/)?([a-p]{32})(?:[\/?#]|$)/;
  
  function currentId() { var m = RE.exec(location.pathname); return m ? m[1] : null; }

  function setup() {
    var id = currentId();
    if (!id) return;

    // Procura o botão original do Google
    var nativeBtn = document.querySelector('button[aria-label*="Add to Chrome"], button[aria-label*="Adicionar ao Chrome"], button[aria-label*="Instalar"]');
    if (!nativeBtn) { var all = document.querySelectorAll('button'); for (var i = 0; i < all.length; i++) { var tx = (all[i].textContent || '').trim(); if (all[i].id !== 'kortex-install-btn' && /^(Usar no Chrome|Add to Chrome|Adicionar ao Chrome|Instalar)/i.test(tx)) { nativeBtn = all[i]; break; } } }
    
    // Se já temos o nosso botão, mas o do Google reapareceu, escondemos o do Google de novo
    if (nativeBtn && document.getElementById('kortex-install-btn')) {
        nativeBtn.style.setProperty('display', 'none', 'important');
        return;
    }

    if (nativeBtn && !document.getElementById('kortex-install-btn')) {
      // 1. Esconde o botão do Google de forma agressiva
      nativeBtn.style.setProperty('display', 'none', 'important');
      
      // 2. Cria o nosso botão
      var btn = document.createElement('button');
      btn.id = 'kortex-install-btn';
      btn.type = 'button';
      // Estilo de pílula igual ao do Google
      btn.style.cssText = 'padding:0 24px; height:48px; border:0; border-radius:999px; background:#ff5722; color:#fff; font:600 15px "Segoe UI",sans-serif; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.2); transition: background 0.2s; display: flex; align-items: center; justify-content: center;';
      btn.textContent = 'Instalar no Kortex';

      var busy = false;
      btn.addEventListener('click', function () {
        if (busy) return;
        if (!window.kortexStore) { btn.textContent = 'Reinicia o Kortex'; return; }
        busy = true; btn.style.background = '#555'; btn.textContent = 'A instalar...';
        window.kortexStore.install(id).then(function (r) {
          if (r && r.success) { btn.style.background = '#10b981'; btn.textContent = 'Instalada!'; }
          else { btn.style.background = '#e5342b'; btn.textContent = 'Erro: ' + ((r && r.error) || 'desconhecido'); }
        }).catch(function (e) {
          btn.style.background = '#e5342b'; btn.textContent = 'Erro: ' + (e.message || 'desconhecido');
        }).then(function () {
          setTimeout(function () { busy = false; btn.style.background = '#ff5722'; btn.textContent = 'Instalar no Kortex'; }, 5000);
        });
      });

      // 3. Insere o nosso botão exatamente onde o do Google estava
      nativeBtn.parentNode.insertBefore(btn, nativeBtn.nextSibling);
    }
  }

  // Verifica a cada 500ms (a loja do Google recarrega os botões frequentemente)
  setInterval(setup, 500);
})();`;

function attachView(view) {
  const wc = view.webContents;
  const run = () => {
    try { if (STORE_URL.test(wc.getURL())) wc.executeJavaScript(STORE_SCRIPT, true).catch(() => {}); } catch {}
  };
  wc.on('dom-ready', run);
  wc.on('did-navigate-in-page', run);
}

function init(c) {
  ctx = c || {};
  ipcMain.handle('store:install', (e, input) => {
    const from = (e.senderFrame && e.senderFrame.url) || e.sender.getURL() || '';
    if (!/^(kortex:|file:|https:\/\/chromewebstore\.google\.com\/)/.test(from)) return { success: false, error: 'Origem nao autorizada.' };
    return install(input);
  });
}

module.exports = { init, attachView, install, parseId, crxToZip, STORE_SCRIPT };