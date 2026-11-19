const path = require('path');
const fs = require('fs');
const { app, session, shell, webContents } = require('electron');
const { getDomain } = require('tldts');
const settings = require('./settings');
const googleCompat = require('./google-compat');

const hostOf = u => { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } };
function isCookieException(host) {
  const list = settings.get('privacy.cookieExceptions') || [];
  return list.some(raw => {
    const e = String(raw).trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^\[\*\.\]/, '').replace(/\/.*$/, '');
    return e && (host === e || host.endsWith('.' + e));
  });
}
const PAGE_DOMAIN_TTL = 1000;
const pageDomainCache = new Map();
function pageDomainOf(wc) {
  const id = wc.id;
  const now = Date.now();
  const hit = pageDomainCache.get(id);
  if (hit && now - hit.ts < PAGE_DOMAIN_TTL) return hit;
  const host = hostOf(wc.getURL());
  const entry = { host, domain: host ? getDomain(host) : '', ts: now };
  pageDomainCache.set(id, entry);
  if (pageDomainCache.size > 500) {
    for (const [k, v] of pageDomainCache) if (now - v.ts > 5000) pageDomainCache.delete(k);
  }
  return entry;
}

function isThirdParty(details) {
  if (details.resourceType === 'mainFrame') return false;
  const wc = details.webContentsId ? webContents.fromId(details.webContentsId) : null;
  if (!wc || wc.isDestroyed()) return false;
  const page = pageDomainOf(wc);
  if (!page.host || isCookieException(page.host)) return false;
  // Exceção para domínios Google (foto de perfil do Gmail)
  if (page.host.endsWith('google.com') || page.host.endsWith('googleusercontent.com')) return false;
  const reqHost = hostOf(details.url);
  if (!reqHost || !page.domain) return false;
  return getDomain(reqHost) !== page.domain;
}
const deleteHeader = (headers, name) => { for (const k of Object.keys(headers)) if (k.toLowerCase() === name) delete headers[k]; };

function setupWebRequest() {
  const ses = session.defaultSession;
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = details.requestHeaders;
    if (settings.get('privacy.dnt')) headers['DNT'] = '1';
    if (settings.get('privacy.gpc')) headers['Sec-GPC'] = '1';
    if (settings.get('privacy.blockThirdPartyCookies') && isThirdParty(details)) deleteHeader(headers, 'cookie');
    callback({ requestHeaders: headers });
  });
  ses.webRequest.onHeadersReceived((details, callback) => {
    const headers = details.responseHeaders;
    if (settings.get('privacy.blockThirdPartyCookies') && isThirdParty(details)) deleteHeader(headers, 'set-cookie');
    callback({ responseHeaders: headers });
  });
}

function uniquePath(dir, name) {
  const safe = path.basename(name);
  const ext = path.extname(safe);
  const base = path.basename(safe, ext);
  let p = path.join(dir, safe);
  let n = 1;
  while (fs.existsSync(p)) p = path.join(dir, `${base} (${n++})${ext}`);
  return p;
}

function setupDownloads() {
  session.defaultSession.on('will-download', (event, item) => {
    if (!settings.get('downloads.askEach')) {
      let dir = settings.get('downloads.folder');
      if (!dir || !fs.existsSync(dir)) dir = app.getPath('downloads');
      item.setSavePath(uniquePath(dir, item.getFilename()));
    }
    if (settings.get('downloads.showWhenDone')) {
      item.once('done', (_e, state) => { if (state === 'completed') shell.showItemInFolder(item.getSavePath()); });
    }
  });
}

function applyZoom(wc) {
  if (!wc || wc.isDestroyed()) return;
  const z = parseFloat(settings.get('appearance.zoom'));
  wc.setZoomFactor(Number.isFinite(z) ? z : 1);
}

const SESSION_FILE = path.join(app.getPath('userData'), 'session-tabs.json');
const isWebUrl = u => typeof u === 'string' && /^https?:\/\//i.test(u);
function saveSessionTabs(getViews) {
  try {
    const urls = Object.values(getViews()).filter(v => !v.isPrivate && !v.webContents.isDestroyed()).map(v => v.webContents.getURL()).filter(isWebUrl);
    fs.writeFileSync(SESSION_FILE, JSON.stringify(urls));
  } catch (e) {}
}
function readSessionTabs() {
  try { const arr = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')); return Array.isArray(arr) ? arr.filter(isWebUrl).slice(0, 30) : []; } catch { return []; }
}

function setupClearOnExit() {
  let done = false;
  app.on('before-quit', (e) => {
    if (done || !settings.get('privacy.clearOnExit')) return;
    e.preventDefault(); done = true;
    Promise.allSettled([ session.defaultSession.clearStorageData({ storages: ['cookies'] }), session.defaultSession.clearCache() ]).finally(() => app.quit());
  });
}

function init({ getViews }) {
  setupWebRequest(); setupDownloads(); setupClearOnExit();
  settings.onChanged((key) => { if (key === 'appearance.zoom') Object.values(getViews()).forEach(v => applyZoom(v.webContents)); });
}
module.exports = { init, applyZoom, saveSessionTabs, readSessionTabs, isThirdParty, isCookieException };