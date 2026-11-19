// src/main/external-protocols.js â€” abrir aplicaÃ§Ãµes externas (roblox://, discord://, steam://, mailto:...)
const { app, shell, dialog, webContents: allWebContents } = require('electron');
const path = require('path');
const fs = require('fs');

const REQUIRE_REGISTERED_HANDLER = false;
const DEDUPE_MS = 4000;
const FLOOD_MAX = 6;
const FLOOD_WINDOW_MS = 10000;
const FLOOD_BLOCK_MS = 30000;
const DENY_COOLDOWN_MS = 30000;

const INTERNAL = new Set(['http', 'https', 'kortex', 'about', 'blob', 'data', 'javascript', 'view-source',
  'chrome-extension', 'chrome', 'chrome-error', 'devtools', 'ws', 'wss', 'filesystem']);
const BLOCKED = new Set(['afp', 'disk', 'disks', 'file', 'hcp', 'ms-help', 'nntp', 'shell', 'vbscript', 'vnd.ms.radio',
  'ms-msdt', 'search-ms', 'search', 'ms-officecmd', 'ms-appinstaller', 'ms-word', 'ms-excel', 'ms-powerpoint',
  'ms-access', 'ms-visio', 'ms-project', 'ms-publisher', 'ms-spd', 'ms-infopath', 'ms-cxh', 'ms-cxh-full',
  'mhtml', 'jar', 'mshta', 'wsh']);

function schemeOf(url) {
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(String(url || '').trim());
  return m ? m[1].toLowerCase() : '';
}

function classify(url) {
  const u = String(url || '').trim();
  const s = schemeOf(u);
  if (!s || s.length > 40) return 'internal';
  if (INTERNAL.has(s)) return 'internal';
  if (u.length > 4096 || /[\u0000-\u001f\u007f]/.test(u)) return 'blocked';
  if (BLOCKED.has(s)) return 'blocked';
  return 'external';
}

function sanitize(url) {
  return String(url).trim().replace(/[ \t"<>`\\^{|}]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
}

const originOf = (u) => { try { const o = new URL(u).origin; return o === 'null' ? '' : o; } catch { return ''; } };
const hostOf = (u) => { try { return new URL(u).host; } catch { return ''; } };

let allowed = null;
const storeFile = () => path.join(app.getPath('userData'), 'external-protocols.json');
function loadAllowed() {
  if (allowed) return allowed;
  try { allowed = JSON.parse(fs.readFileSync(storeFile(), 'utf8')) || {}; } catch { allowed = {}; }
  return allowed;
}
function saveAllowed() { try { fs.writeFileSync(storeFile(), JSON.stringify(allowed)); } catch {} }
function forgetAll() { allowed = {}; saveAllowed(); }

function note(msg) {
  try {
    for (const w of allWebContents.getAllWebContents()) {
      const u = String(w.getURL() || '').split(/[?#]/)[0];
      if (u.startsWith('file:') && /\/renderer\/index\.html$/.test(u)) w.send('toast', msg);
    }
  } catch {}
}

const recent = new Map();
const hits = new Map();
const mutedUntil = new Map();
const deniedUntil = new Map();
let prompting = false;

function appNameFor(url) {
  try { return app.getApplicationNameForProtocol(url) || ''; } catch { return ''; }
}

async function ask(host, scheme, appName, shortUrl) {
  const r = await dialog.showMessageBox({
    type: 'question', buttons: ['Abrir', 'Cancelar'], defaultId: 0, cancelId: 1, noLink: true,
    title: 'Abrir aplicaÃ§Ã£o externa',
    message: 'Abrir ' + (appName || scheme + ':') + '?',
    detail: (host || 'Este site') + ' quer abrir uma aplicaÃ§Ã£o no teu computador.\n\n' + shortUrl,
    checkboxLabel: 'Permitir sempre que ' + (host || 'este site') + ' abra links ' + scheme + ':',
    checkboxChecked: false
  });
  return { ok: r.response === 0, remember: r.checkboxChecked };
}

async function handle(rawUrl, originUrl, source) {
  try {
    const kind = classify(rawUrl);
    if (kind === 'internal') return { handled: false };
    const scheme = schemeOf(rawUrl);
    const origin = originOf(originUrl) || 'desconhecida';
    const host = hostOf(originUrl);

    if (kind === 'blocked') { note('Bloqueado: ' + (host || 'o site') + ' tentou abrir Â«' + scheme + ':Â»'); return { handled: true, opened: false }; }

    const now = Date.now();
    if ((mutedUntil.get(origin) || 0) > now) return { handled: true, opened: false };
    const key = origin + '|' + rawUrl;
    if ((recent.get(key) || 0) > now - DEDUPE_MS) return { handled: true, opened: false };
    recent.set(key, now);
    if (recent.size > 200) for (const [k, t] of recent) if (t < now - DEDUPE_MS) recent.delete(k);

    const arr = (hits.get(origin) || []).filter((t) => t > now - FLOOD_WINDOW_MS);
    arr.push(now); hits.set(origin, arr);
    if (arr.length > FLOOD_MAX) { mutedUntil.set(origin, now + FLOOD_BLOCK_MS); note('Bloqueados pedidos repetidos de ' + (host || 'um site') + ' para abrir aplicaÃ§Ãµes.'); return { handled: true, opened: false }; }

    const url = sanitize(rawUrl);
    const appName = appNameFor(url);
    if (!appName && REQUIRE_REGISTERED_HANDLER) {
      note('NÃ£o encontrei nenhuma aplicaÃ§Ã£o instalada para abrir Â«' + scheme + ':Â»');
      return { handled: true, opened: false, reason: 'no-handler' };
    }

    const rule = origin + '|' + scheme;
    if (!loadAllowed()[rule]) {
      if (prompting || (deniedUntil.get(rule) || 0) > now) return { handled: true, opened: false };
      prompting = true;
      let res;
      try { res = await ask(host, scheme, appName, url.length > 140 ? url.slice(0, 140) + 'â€¦' : url); }
      finally { prompting = false; }
      if (!res.ok) { deniedUntil.set(rule, Date.now() + DENY_COOLDOWN_MS); return { handled: true, opened: false }; }
      if (res.remember) { loadAllowed()[rule] = true; saveAllowed(); }
    }

    await shell.openExternal(url);
    return { handled: true, opened: true };
  } catch (e) {
    note('NÃ£o foi possÃ­vel abrir a aplicaÃ§Ã£o: ' + (e && e.message ? e.message : e));
    return { handled: true, opened: false, error: String(e && e.message || e) };
  }
}

const urlOf = (e, a) => (e && e.url) || (typeof a === 'string' ? a : '');

function hook(wc) {
  const guard = (event, a) => {
    try {
      if (event && event.isSameDocument) return;
      const url = urlOf(event, a);
      if (!url || classify(url) === 'internal') return;
      event.preventDefault();
      handle(url, wc.getURL(), 'navigation');
    } catch {}
  };
  wc.on('will-navigate', guard);
  wc.on('will-frame-navigate', guard);
  wc.on('will-redirect', guard);
}

function windowOpenGuard(wc) {
  return ({ url }) => {
    if (classify(url) !== 'internal') { handle(url, wc.getURL(), 'window.open'); return { action: 'deny' }; }
    return { action: 'allow' };
  };
}

app.on('web-contents-created', (e, wc) => {
  hook(wc);
  try { if (wc.getType() === 'window') wc.setWindowOpenHandler(windowOpenGuard(wc)); } catch {}
});

module.exports = { handle, classify, sanitize, schemeOf, forgetAll, isExternalUrl: (u) => classify(u) !== 'internal' };
