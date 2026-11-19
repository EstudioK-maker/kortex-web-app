'use strict';
const { app, ipcMain, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const FILE = path.join(app.getPath('userData'), 'google-accounts.json');
function readAccounts() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { return []; } }

function openPopup(wc) {
  const accounts = readAccounts();
  const rows = accounts.map(a => `
    <div style="display:flex; align-items:center; padding:10px; border-bottom:1px solid #333;">
      <div style="width:36px;height:36px;border-radius:50%;background:#ff5722;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;margin-right:12px;">${a.email.charAt(0).toUpperCase()}</div>
      <div style="flex:1;color:#eee;font-size:14px;">${a.email}</div>
      <button class="acc-switch" data-email="${a.email}" style="background:#4caf50;color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;">Usar</button>
    </div>
  `).join('');

  const html = `
    <html><head><style>body { background: #1e1e1e; color: #fff; font-family: Segoe UI, sans-serif; margin: 0; padding: 20px; } input { background:#2c2d31; border:1px solid #444; color:#fff; padding:10px; border-radius:6px; outline:none; flex:1; } button.add { background:#ff5722; color:#fff; border:none; padding:0 16px; border-radius:6px; cursor:pointer; font-weight:bold; }</style></head>
    <body>
      <h2 style="margin-top: 0; font-size: 18px;">Contas Google</h2>
      <div style="max-height: 250px; overflow-y: auto; margin-bottom: 16px; background:#252525; border-radius:8px;">
        ${rows || '<div style="padding:20px;color:#888;text-align:center;">Nenhuma conta adicionada.</div>'}
      </div>
      <div style="display:flex; gap:8px;">
        <input type="email" id="new-acc-email" placeholder="Adicionar nova conta...">
        <button class="add" id="btn-add-acc">Add</button>
      </div>
      <script>
        const { ipcRenderer } = require('electron');
        document.getElementById('btn-add-acc').onclick = () => {
          const em = document.getElementById('new-acc-email').value;
          if(em) { ipcRenderer.send('google-accounts:add', em); window.close(); }
        };
        document.querySelectorAll('.acc-switch').forEach(b => {
          b.onclick = () => { ipcRenderer.send('google-accounts:switch', b.dataset.email); window.close(); };
        });
      </script>
    </body></html>
  `;

  const win = new BrowserWindow({
    width: 400, height: 350, resizable: false, frame: true, title: "Kortex - Contas",
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
}

function init(ctx) {
  ipcMain.on('google-accounts:add', (e, email) => {
    const list = readAccounts();
    if (!list.some(a => a.email === email)) { list.push({ email, addedAt: Date.now() }); try { fs.writeFileSync(FILE, JSON.stringify(list)); } catch(e){} }
  });
  ipcMain.on('google-accounts:switch', (e, email) => {
    if (ctx && ctx.createNewTab) ctx.createNewTab('https://accounts.google.com/AccountChooser?Email=' + encodeURIComponent(email) + '&continue=https://mail.google.com/');
  });
}
module.exports = { init, openPopup };