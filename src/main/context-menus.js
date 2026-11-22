'use strict';
const { app, Menu, clipboard, BrowserWindow } = require('electron');

function init({ createNewTab, getChromeView, getPageViews, getSettings }) {
  const searchUrl = (q) => {
    try { const s = getSettings && getSettings(); if (s && typeof s.searchUrl === 'function') return s.searchUrl(q); } catch (e) {}
    return 'https://www.google.com/search?q=' + encodeURIComponent(q);
  };
  const kind = (wc) => {
    try {
      const cv = getChromeView && getChromeView();
      if (cv && cv.webContents === wc) return 'chrome';
      const views = (getPageViews && getPageViews()) || {};
      if (Object.values(views).some((v) => v && v.webContents === wc)) return 'page';
    } catch (e) {}
    return null;
  };
  const SEP = { type: 'separator' };

  app.on('web-contents-created', (e, wc) => {
    wc.on('context-menu', (ev, p) => {
      const k = kind(wc);
      if (!k) return;
      const t = [];
      const add = (...items) => { if (t.length && items.length && t[t.length - 1].type !== 'separator') t.push(SEP); t.push(...items); };
      const sel = (p.selectionText || '').trim();
      const ef = p.editFlags || {};

      if (p.isEditable) {
        t.push({ label: 'Anular', role: 'undo', enabled: !!ef.canUndo }, { label: 'Refazer', role: 'redo', enabled: !!ef.canRedo }, SEP,
          { label: 'Cortar', role: 'cut', enabled: !!ef.canCut }, { label: 'Copiar', role: 'copy', enabled: !!ef.canCopy },
          { label: 'Colar', role: 'paste', enabled: !!ef.canPaste }, { label: 'Selecionar tudo', role: 'selectAll' });
      } else if (k === 'chrome') {
        return;
      } else {
        if (p.linkURL) {
          add({ label: 'Abrir ligação num novo separador', click: () => createNewTab(p.linkURL) },
              { label: 'Copiar endereço da ligação', click: () => clipboard.writeText(p.linkURL) });
        }
        if (p.mediaType === 'image' && p.srcURL) {
          add({ label: 'Abrir imagem num novo separador', click: () => createNewTab(p.srcURL) },
              { label: 'Guardar imagem como…', click: () => wc.downloadURL(p.srcURL) },
              { label: 'Copiar imagem', click: () => wc.copyImageAt(p.x, p.y) },
              { label: 'Copiar endereço da imagem', click: () => clipboard.writeText(p.srcURL) });
        }
        if (sel) {
          const short = sel.length > 28 ? sel.slice(0, 28) + '…' : sel;
          add({ label: 'Copiar', role: 'copy' },
              { label: 'Pesquisar «' + short + '»', click: () => createNewTab(searchUrl(sel)) });
        }
        if (!p.linkURL && p.mediaType !== 'image' && !sel) {
          const nh = wc.navigationHistory;
          const canBack = nh ? nh.canGoBack() : wc.canGoBack();
          const canFwd = nh ? nh.canGoForward() : wc.canGoForward();
          add({ label: 'Recuar', enabled: canBack, click: () => (nh ? nh.goBack() : wc.goBack()) },
              { label: 'Avançar', enabled: canFwd, click: () => (nh ? nh.goForward() : wc.goForward()) },
              { label: 'Recarregar', click: () => wc.reload() });
          add({ label: 'Ver código-fonte', click: () => createNewTab('view-source:' + wc.getURL()) });
        }
        add({ label: 'Inspecionar', click: () => wc.inspectElement(p.x, p.y) });
      }

      if (!t.length) return;
      Menu.buildFromTemplate(t).popup({ window: BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] });
    });
  });
}

module.exports = { init };