'use strict';
const { app, dialog, shell } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { execFileSync } = require('child_process');

const PROTOCOLS = ['http', 'https'];
const FILE_EXTS = new Set(['.html', '.htm', '.xhtml', '.pdf', '.svg']);
const log = (...a) => console.log('[default-browser]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function stateFile() { return path.join(app.getPath('userData'), 'first-run.json'); }
function readState() { try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch (e) { return {}; } }
function writeState(patch) { try { fs.writeFileSync(stateFile(), JSON.stringify(Object.assign(readState(), patch))); } catch (e) {} }
function resetPrompt() { writeState({ defaultBrowserAsked: false }); }

let isDefaultCache = null;
function isDefault() {
  if (isDefaultCache && Date.now() - isDefaultCache.at < 3000) return isDefaultCache.value;
  let value = false;
  try {
    const handler = String(app.getApplicationNameForProtocol('https://') || '').toLowerCase();
    if (handler) {
      const names = [app.getName(), path.basename(process.execPath, path.extname(process.execPath))].map((s) => String(s || '').toLowerCase()).filter(Boolean);
      value = names.some((n) => handler.includes(n));
    } else {
      value = PROTOCOLS.every((p) => app.isDefaultProtocolClient(p));
    }
  } catch (e) { value = false; }
  isDefaultCache = { value, at: Date.now() };
  return value;
}

const WIN_APP_NAME = 'Kortex';
const WIN_FILE_EXTS = ['.htm', '.html', '.xhtml', '.pdf', '.svg'];

function regEsc(v) { return String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }
function winCommands() {
  const exe = process.execPath;
  const open = app.isPackaged ? '"' + exe + '"' : '"' + exe + '" "' + app.getAppPath() + '"';
  return { exe, open, withArg: open + ' "%1"' };
}

function buildRegistrationReg() {
  const { exe, open, withArg } = winCommands();
  const root = 'HKEY_CURRENT_USER\\Software\\';
  const cap = 'Clients\\StartMenuInternet\\' + WIN_APP_NAME + '\\Capabilities';
  const out = ['Windows Registry Editor Version 5.00', ''];
  const section = (key, pairs) => {
    out.push('[' + root + key + ']');
    pairs.forEach(([n, v]) => out.push((n === '@' ? '@' : '"' + regEsc(n) + '"') + '="' + regEsc(v) + '"'));
    out.push('');
  };
  section('Classes\\KortexURL', [['@', 'Kortex URL'], ['URL Protocol', '']]);
  section('Classes\\KortexURL\\DefaultIcon', [['@', exe + ',0']]);
  section('Classes\\KortexURL\\shell\\open\\command', [['@', withArg]]);
  section('Classes\\KortexHTML', [['@', 'Kortex Document']]);
  section('Classes\\KortexHTML\\DefaultIcon', [['@', exe + ',0']]);
  section('Classes\\KortexHTML\\shell\\open\\command', [['@', withArg]]);
  section('Clients\\StartMenuInternet\\' + WIN_APP_NAME, [['@', WIN_APP_NAME]]);
  section('Clients\\StartMenuInternet\\' + WIN_APP_NAME + '\\DefaultIcon', [['@', exe + ',0']]);
  section(cap, [['ApplicationName', WIN_APP_NAME], ['ApplicationDescription', 'Kortex Browser'], ['ApplicationIcon', exe + ',0']]);
  section(cap + '\\URLAssociations', [['http', 'KortexURL'], ['https', 'KortexURL']]);
  section(cap + '\\FileAssociations', WIN_FILE_EXTS.map((e) => [e, 'KortexHTML']));
  section('Clients\\StartMenuInternet\\' + WIN_APP_NAME + '\\shell\\open\\command', [['@', open]]);
  section('RegisteredApplications', [[WIN_APP_NAME, 'Software\\' + cap]]);
  return out.join('\r\n');
}

function buildUnregistrationReg() {
  const root = 'HKEY_CURRENT_USER\\Software\\';
  return [
    'Windows Registry Editor Version 5.00', '',
    '[-' + root + 'Classes\\KortexURL]', '',
    '[-' + root + 'Classes\\KortexHTML]', '',
    '[-' + root + 'Clients\\StartMenuInternet\\' + WIN_APP_NAME + ']', '',
    '[' + root + 'RegisteredApplications]', '"' + WIN_APP_NAME + '"=-', ''
  ].join('\r\n');
}

function buildOpenWithProgidsReg() {
  const root = 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\';
  const out = ['Windows Registry Editor Version 5.00', ''];
  WIN_FILE_EXTS.forEach((ext) => {
    out.push('[' + root + ext + '\\OpenWithProgids]');
    out.push('"KortexHTML"=hex(0):');
    out.push('');
  });
  return out.join('\r\n');
}

function buildOpenWithProgidsRemovalReg() {
  const root = 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\';
  const out = ['Windows Registry Editor Version 5.00', ''];
  WIN_FILE_EXTS.forEach((ext) => {
    out.push('[' + root + ext + '\\OpenWithProgids]');
    out.push('"KortexHTML"=-');
    out.push('');
  });
  return out.join('\r\n');
}

function importReg(text) {
  const file = path.join(os.tmpdir(), 'kortex-' + Date.now() + '.reg');
  fs.writeFileSync(file, Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(text, 'utf16le')]));
  try { execFileSync('reg', ['import', file], { windowsHide: true, stdio: 'ignore' }); return true; }
  catch (e) { log('reg import falhou:', e && e.message); return false; }
  finally { try { fs.unlinkSync(file); } catch (e) {} }
}

function registerWindows() {
  if (process.platform !== 'win32') return false;
  const a = importReg(buildRegistrationReg());
  const b = importReg(buildOpenWithProgidsReg());
  if (!b) log('aviso: OpenWithProgids não foi escrito');
  return a;
}

function unregisterWindows() {
  if (process.platform !== 'win32') return false;
  importReg(buildOpenWithProgidsRemovalReg());
  return importReg(buildUnregistrationReg());
}

function openWindowsDefaultApps() {
  const build = parseInt(String(os.release()).split('.')[2], 10) || 0;
  const url = build >= 22000 ? 'ms-settings:defaultapps?registeredAppUser=' + encodeURIComponent(WIN_APP_NAME) : 'ms-settings:defaultapps';
  return shell.openExternal(url).catch(() => {});
}

async function makeDefault({ parentWindow } = {}) {
  const win = process.platform === 'win32';
  if (!win && !app.isPackaged) return { ok: false, reason: 'not-packaged' };

  let ok = true;
  if (win) {
    ok = registerWindows();
    log('registo no Windows (HKCU):', ok ? 'ok' : 'FALHOU');
    if (!ok) {
      await dialog.showMessageBox(parentWindow || undefined, {
        type: 'error', title: 'Kortex', message: 'Não foi possível registar o Kortex no Windows.',
        detail: 'Verifica se tens permissões de escrita no teu perfil de utilizador e tenta novamente.'
      });
      return { ok: false, needsUserAction: true };
    }
    await sleep(600);
    await dialog.showMessageBox(parentWindow || undefined, {
      type: 'info', title: 'Kortex',
      message: 'Falta só um passo — tem de ser feito pelo Windows.',
      detail: 'O Kortex já está pronto para ser escolhido. Nas Definições que vão abrir, carrega em ' +
        '"Set default" junto ao Kortex. O Windows 11 só aceita a mudança de navegador predefinido ' +
        'quando é o próprio utilizador a confirmar ali — nenhuma app o pode fazer por ti.',
      buttons: ['Abrir Definições'], defaultId: 0, noLink: true
    });
    await openWindowsDefaultApps();
  } else {
    for (const p of PROTOCOLS) { try { ok = app.setAsDefaultProtocolClient(p) && ok; } catch (e) { ok = false; } }
  }
  return { ok, needsUserAction: win };
}

async function offerOnFirstRun({ getWindow, canPrompt } = {}) {
  if (process.env.KORTEX_RESET_DEFAULT_PROMPT) resetPrompt();
  if (readState().defaultBrowserAsked) { log('já foi perguntado antes: a saltar'); return; }
  if (isDefault()) { log('o Kortex já é o predefinido'); writeState({ defaultBrowserAsked: true }); return; }
  if (!app.isPackaged && !process.env.KORTEX_FORCE_DEFAULT_PROMPT) { log('modo dev: pergunta desativada'); return; }

  for (let i = 0; i < 30 && typeof canPrompt === 'function' && !canPrompt(); i++) await sleep(2000);

  const win = process.platform === 'win32';
  const mac = process.platform === 'darwin';
  const opts = {
    type: 'question', title: 'Kortex', message: 'Tornar o Kortex o teu navegador predefinido?',
    detail: win ? 'O Windows vai abrir as Definições: em "Navegador web" escolhe Kortex.' : (mac ? 'O macOS vai pedir-te para confirmar a mudança.' : 'Os links de outras aplicações passam a abrir no Kortex.'),
    buttons: ['Tornar predefinido', 'Agora não'], defaultId: 0, cancelId: 1, noLink: true
  };
  const parent = typeof getWindow === 'function' ? getWindow() : null;
  try { if (parent && !parent.isDestroyed()) { parent.show(); parent.focus(); } } catch (e) {}
  let r;
  try { r = await (parent && !parent.isDestroyed() ? dialog.showMessageBox(parent, opts) : dialog.showMessageBox(opts)); }
  catch (e) { r = await dialog.showMessageBox(opts); }
  writeState({ defaultBrowserAsked: true });
  log('resposta:', r.response === 0 ? 'tornar predefinido' : 'agora não');
  if (r.response === 0) log('resultado:', JSON.stringify(await makeDefault({ parentWindow: parent })));
}

function isSafeWebUrl(u) { try { const p = new URL(u).protocol; return p === 'http:' || p === 'https:'; } catch (e) { return false; } }
function fileToUrl(p) { try { const abs = path.resolve(p); if (FILE_EXTS.has(path.extname(abs).toLowerCase()) && fs.statSync(abs).isFile()) return pathToFileURL(abs).href; } catch (e) {} return null; }
function urlFromArgv(argv) {
  for (const a of (argv || []).slice(1)) {
    if (!a || a.startsWith('-')) continue;
    if (isSafeWebUrl(a)) return a;
    const f = fileToUrl(a); if (f) return f;
  }
  return null;
}

let openUrlFn = null;
const pending = [];
function deliver(url) { if (!url) return; if (openUrlFn) openUrlFn(url); else pending.push(url); }

app.on('open-url', (e, url) => { e.preventDefault(); if (isSafeWebUrl(url)) deliver(url); });
app.on('open-file', (e, filePath) => { e.preventDefault(); deliver(fileToUrl(filePath)); });

function init({ openUrl, getWindow, canPrompt, handleSecondInstance = false, handleColdStart = false, offerDelayMs = 1500 } = {}) {
  if (typeof openUrl !== 'function') throw new Error('default-browser: init({ openUrl }) é obrigatório');
  openUrlFn = openUrl;
  log('init | instalada:', app.isPackaged, '| já é predefinido:', isDefault());
  if (handleSecondInstance) app.on('second-instance', (_e, argv) => deliver(urlFromArgv(argv)));
  if (handleColdStart) deliver(urlFromArgv(process.argv));
  while (pending.length) openUrlFn(pending.shift());
  setTimeout(() => { offerOnFirstRun({ getWindow, canPrompt }).catch((e) => log('erro na pergunta:', e && e.message)); }, offerDelayMs);
}

module.exports = { init, isDefault, makeDefault, offerOnFirstRun, resetPrompt, urlFromArgv, registerWindows, unregisterWindows };