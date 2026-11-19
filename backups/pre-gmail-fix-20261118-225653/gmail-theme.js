'use strict';
const { ipcMain } = require('electron');

function injectButton(wc) {
  const script = `
    (function() {
      if (document.getElementById('kortex-contas-btn')) return;
      const btn = document.createElement('div');
      btn.id = 'kortex-contas-btn';
      btn.innerHTML = '<span style="color:white; font-weight:bold; font-size:14px;">K</span> Contas';
      btn.style.cssText = 'position:fixed; bottom:24px; right:24px; background:#ff5722; color:white; padding:12px 20px; border-radius:30px; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.4); z-index:999999; font-family:Sans-Serif; display:flex; align-items:center; gap:8px; transition:transform 0.2s;';
      btn.onmouseenter = () => btn.style.transform = 'scale(1.05)';
      btn.onmouseleave = () => btn.style.transform = 'scale(1)';
      btn.onclick = () => { window.location.href = 'kortex://google-accounts'; };
      document.body.appendChild(btn);
    })();
    null;
  `;
  wc.executeJavaScript(script).catch(() => {});
}

function init() {
  const { app } = require('electron');
  app.on('web-contents-created', (e, wc) => {
    wc.on('did-finish-load', () => {
      if (wc.getURL().includes('mail.google.com')) injectButton(wc);
    });
    wc.on('did-navigate-in-page', () => {
      if (wc.getURL().includes('mail.google.com')) injectButton(wc);
    });
  });
}
module.exports = { init, injectButton };