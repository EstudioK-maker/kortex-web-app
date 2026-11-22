const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const RELEASE_NOTES = {
  '1.0.43': [
    'Agora podes colar imagens (Ctrl+V) diretamente no Assistente!',
    'A IA consegue ler e analisar os prints que envias.',
    'Correção do bug onde a miniatura da imagem ficava presa no chat.',
    'Melhorias gerais de estabilidade no Spotify e links externos.'
  ],
  '1.0.44': [
    'Popups agora aparecem de forma elegante dentro do próprio browser.',
    'O que há de novo aparece após cada atualização.'
  ]
};

function getLastSeenVersion() {
  try {
    const p = path.join(app.getPath('userData'), 'last-seen-version.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8')).version;
  } catch(e) {}
  return null;
}

function setLastSeenVersion(v) {
  try {
    const p = path.join(app.getPath('userData'), 'last-seen-version.json');
    fs.writeFileSync(p, JSON.stringify({ version: v }));
  } catch(e) {}
}

function checkAndShow(chromeView) {
  const currentVersion = app.getVersion();
  const lastSeen = getLastSeenVersion();
  
  if (!lastSeen || lastSeen !== currentVersion) {
    const notes = RELEASE_NOTES[currentVersion] || ['Melhorias de estabilidade e correções de bugs.'];
    
    // Escapa as aspas para o HTML
    const list = notes.map(n => '<li style="margin-bottom: 8px;">' + n + '</li>').join('');
    
    const html = '<div style="padding: 24px;">' +
        '<h1 style="color: #ff5722; margin-top: 0; font-size: 22px; display: flex; align-items: center; gap: 8px;">✨ O que há de novo na v' + currentVersion + '</h1>' +
        '<p style="color: #aaa; font-size: 14px; margin-bottom: 20px;">Atualizámos o Kortex com estas novidades para ti:</p>' +
        '<ul style="line-height: 1.5; font-size: 14px; color: #e0e0e0; padding-left: 20px; margin-bottom: 24px;">' + list + '</ul>' +
        '<div style="display: flex; justify-content: flex-end;">' +
          '<button onclick="window.KortexModal.hide()" style="background: #ff5722; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer;">Entendido, vamos a isso!</button>' +
        '</div>' +
      '</div>';
    
    if (chromeView && !chromeView.webContents.isDestroyed()) {
      const modalJs = "if (!window.KortexModal) { window.KortexModal = { show: function(h) { let o = document.getElementById('kortex-modal-overlay'); if (!o) { o = document.createElement('div'); o.id = 'kortex-modal-overlay'; o.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 999999; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s;'; const b = document.createElement('div'); b.id = 'kortex-modal-box'; b.style.cssText = 'background: #1e1e1e; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-width: 500px; width: 100%; transform: scale(0.95); transition: transform 0.2s; color: #fff; font-family: Segoe UI, sans-serif; overflow: hidden;'; o.appendChild(b); document.body.appendChild(o); o.addEventListener('click', (e) => { if (e.target === o) window.KortexModal.hide(); }); } const b = document.getElementById('kortex-modal-box'); b.innerHTML = h; requestAnimationFrame(() => { o.style.opacity = '1'; b.style.transform = 'scale(1)'; }); }, hide: function() { const o = document.getElementById('kortex-modal-overlay'); if (o) { o.style.opacity = '0'; const b = document.getElementById('kortex-modal-box'); if (b) b.style.transform = 'scale(0.95)'; setTimeout(() => o.remove(), 200); } } }; }";
      
      chromeView.webContents.executeJavaScript(modalJs).then(() => {
        chromeView.webContents.executeJavaScript('window.KortexModal.show(' + JSON.stringify(html) + ')');
      });
    }
  }
  setLastSeenVersion(currentVersion);
}

module.exports = { checkAndShow };
