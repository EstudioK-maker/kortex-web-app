'use strict';
const { ipcMain, BrowserWindow, app } = require('electron');
const path = require('path');
const fs = require('fs');

let popup = null;

function accountsFile() {
  try { return path.join(app.getPath('userData'), 'google-accounts.json'); }
  catch (e) { return path.join(__dirname, 'google-accounts.json'); }
}

function popupHtmlFile() {
  try { return path.join(app.getPath('userData'), 'kortex-accounts.html'); }
  catch (e) { return path.join(__dirname, 'kortex-accounts.html'); }
}

function loadAccounts() {
  try {
    const data = JSON.parse(fs.readFileSync(accountsFile(), 'utf8'));
    return Array.isArray(data.accounts) ? data.accounts : [];
  } catch (e) { return []; }
}

const POPUP_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>K Contas</title>
  <style>
    * { box-sizing: border-box; -webkit-font-smoothing: antialiased; }
    body { margin: 0; padding: 0; font-family: 'Segoe UI', system-ui, sans-serif; background: #0f0f13; color: #fff; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
    
    /* Header */
    .header { padding: 20px; background: #16161d; border-bottom: 1px solid #22222b; display: flex; align-items: center; gap: 12px; }
    .logo { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #ff8a3d, #ff5722); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; color: #fff; box-shadow: 0 4px 10px rgba(255,87,34,0.3); }
    .title { font-size: 16px; font-weight: 600; letter-spacing: 0.3px; }
    .subtitle { font-size: 12px; color: #888; margin-top: 2px; }

    /* List Area */
    .content { padding: 20px; flex: 1; overflow-y: auto; }
    .account { display: flex; align-items: center; gap: 14px; padding: 14px; background: #1a1a21; border-radius: 12px; margin-bottom: 10px; border: 1px solid transparent; transition: all 0.2s ease; }
    .account:hover { background: #202028; border-color: #333; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
    
    .avatar { width: 38px; height: 38px; border-radius: 50%; background: #2a2a35; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 15px; color: #ff8a3d; flex-shrink: 0; }
    .email { flex: 1; font-size: 14px; font-weight: 500; color: #e3e3e8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    
    .btn-use { background: #ff5722; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 12px; transition: opacity 0.2s; }
    .btn-use:hover { opacity: 0.85; }
    
    .btn-del { background: transparent; color: #ff4444; border: none; padding: 8px; cursor: pointer; border-radius: 8px; transition: background 0.2s; display: flex; align-items: center; justify-content: center; }
    .btn-del:hover { background: rgba(255, 68, 68, 0.15); }
    
    .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #666; font-size: 14px; text-align: center; gap: 8px; }
    
    /* Footer / Input */
    .footer { padding: 20px; background: #16161d; border-top: 1px solid #22222b; }
    .input-group { display: flex; gap: 10px; background: #0f0f13; border: 1px solid #333; padding: 6px; border-radius: 12px; transition: border-color 0.2s; }
    .input-group:focus-within { border-color: #ff5722; }
    .input-group input { flex: 1; background: transparent; border: none; color: #fff; padding: 8px 12px; outline: none; font-size: 13px; }
    .input-group input::placeholder { color: #555; }
    .btn-add { background: #ff5722; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px; transition: opacity 0.2s; }
    .btn-add:hover { opacity: 0.85; }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #444; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">K</div>
    <div>
      <div class="title">K Contas</div>
      <div class="subtitle">Gestor de Contas Google</div>
    </div>
  </div>
  
  <div class="content" id="list"></div>
  
  <div class="footer">
    <div class="input-group">
      <input id="accEmail" type="email" placeholder="Adicionar email do Gmail..." autocomplete="off">
      <button class="btn-add" id="btnAdd">Adicionar</button>
    </div>
  </div>

  <script>
    const fs = require("fs");
    const path = require("path");
    const { app } = require("electron");
    const FILE = path.join(app.getPath("userData"), "google-accounts.json");

    function readAll() { try { const d = JSON.parse(fs.readFileSync(FILE, "utf8")); return { accounts: Array.isArray(d.accounts) ? d.accounts : [], active: d.active || "" }; } catch (e) { return { accounts: [], active: "" }; } }
    function writeAll(accounts, active) { fs.writeFileSync(FILE, JSON.stringify({ accounts: accounts, active: active || "" }, null, 2), "utf8"); }
    function esc(s) { const d = document.createElement("div"); d.textContent = String(s || ""); return d.innerHTML; }

    function render() {
      const { accounts, active } = readAll();
      const list = document.getElementById("list");
      
      if (!accounts.length) { 
          list.innerHTML = '<div class="empty"><span>Sem contas guardadas</span><span style="font-size:12px; color:#444;">Adiciona o teu primeiro email abaixo</span></div>'; 
          return; 
      }
      
      list.innerHTML = accounts.map(function (acc, i) {
        const initial = esc(acc.email.charAt(0).toUpperCase());
        const isActive = acc.email === active;
        return '<div class="account" style="' + (isActive ? 'border-color: #ff5722;' : '') + '">' +
          '<div class="avatar">' + initial + '</div>' +
          '<div class="email">' + esc(acc.email) + '</div>' +
          '<button class="btn-use" onclick="useAccount(' + i + ')">' + (isActive ? 'Ativa' : 'Usar') + '</button>' +
          '<button class="btn-del" onclick="removeAccount(' + i + ')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>' +
        '</div>';
      }).join("");
    }

    document.getElementById("btnAdd").onclick = function() {
      const email = document.getElementById("accEmail").value.trim();
      if (!email) return;
      const { accounts, active } = readAll();
      if (!accounts.some(function(a) { return a.email === email; })) { 
          accounts.push({ email: email }); 
          writeAll(accounts, active); 
      }
      document.getElementById("accEmail").value = "";
      render();
    };

    window.useAccount = function(i) {
      const { accounts } = readAll();
      writeAll(accounts, accounts[i].email);
      render();
    };

    window.removeAccount = function(i) {
      const { accounts, active } = readAll();
      accounts.splice(i, 1);
      writeAll(accounts, active);
      render();
    };

    render();
  </script>
</body>
</html>
`;

function writePopupHtml() {
  const file = popupHtmlFile();
  try { fs.writeFileSync(file, POPUP_HTML, 'utf8'); return file; }
  catch (e) { return null; }
}

function openPopup() {
  if (popup && !popup.isDestroyed()) { popup.show(); popup.focus(); return popup; }
  popup = new BrowserWindow({
    width: 440, height: 520, show: false, autoHideMenuBar: true, resizable: false,
    backgroundColor: '#0f0f13', title: 'K Contas',
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  popup.on('closed', () => { popup = null; });
  const htmlFile = writePopupHtml();
  if (htmlFile) popup.loadFile(htmlFile);
  else popup.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<h1>K Contas</h1>'));
  popup.once('ready-to-show', () => { if (popup) popup.show(); });
  return popup;
}

ipcMain.on('open-kortex-accounts', () => { try { openPopup(); } catch (e) {} });
module.exports = { openPopup, loadAccounts };