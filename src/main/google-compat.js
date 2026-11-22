'use strict';
const path = require('path');
const { app, session } = require('electron');

const FULL = (process.versions && process.versions.chrome) || '131.0.0.0';
const MAJOR = Number(String(FULL).split('.')[0]) || 131;

const GREASE_CHARS = [' ', '(', ':', '-', '.', '/', ')', ';', '=', '?', '_'];
const GREASE_VERSIONS = ['8', '99', '24'];
const ORDERS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

function buildBrandList(seed, version, fullList) {
  const brand = 'Not' + GREASE_CHARS[seed % GREASE_CHARS.length] + 'A' + GREASE_CHARS[(seed + 1) % GREASE_CHARS.length] + 'Brand';
  const gv = GREASE_VERSIONS[seed % GREASE_VERSIONS.length];
  const order = ORDERS[seed % ORDERS.length];
  const list = [];
  list[order[0]] = { brand, version: fullList ? gv + '.0.0.0' : gv };
  list[order[1]] = { brand: 'Chromium', version };
  list[order[2]] = { brand: 'Google Chrome', version };
  return list;
}
const fmt = (list) => list.map((b) => `"${b.brand}";v="${b.version}"`).join(', ');

const BRANDS = buildBrandList(MAJOR, String(MAJOR), false);
const BRANDS_FULL = buildBrandList(MAJOR, FULL, true);
const GREASE_BRAND = BRANDS.find((b) => b.brand !== 'Chromium' && b.brand !== 'Google Chrome').brand;

const PLATFORM_VERSION = '15.0.0';
const UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${MAJOR}.0.0.0 Safari/537.36`;
const SEC_CH_UA = fmt(BRANDS);
const SEC_CH_UA_FULL = fmt(BRANDS_FULL);
const SPOOF_PATH = path.join(__dirname, '../preload/chrome-spoof.js');

try { app.userAgentFallback = UA; } catch (e) {}

const AUTH_HOSTS = new Set(['accounts.google.com', 'accounts.youtube.com']);
const isGoogleAuthHost = (h) => AUTH_HOSTS.has(String(h || '').toLowerCase());
const isGoogleHost = (h) => /(^|\.)(google\.com|youtube\.com)$/i.test(String(h || ''));

function isGoogleAuthUrl(u) {
  try {
    const x = new URL(u);
    if (isGoogleAuthHost(x.hostname)) return true;
    return x.hostname === 'www.google.com' && /^\/(accounts|o\/oauth2|signin)/.test(x.pathname);
  } catch (e) { return false; }
}

function setHeader(headers, name, value) {
  const n = name.toLowerCase();
  for (const k of Object.keys(headers)) if (k.toLowerCase() === n) delete headers[k];
  headers[name] = value;
}
const hasHeader = (headers, name) => Object.keys(headers).some((k) => k.toLowerCase() === name);

function fixRequestHeaders(details, headers) {
  const url = details.url || '';
  if (!/^https?:/i.test(url)) return;
  setHeader(headers, 'User-Agent', UA);
  if (!url.startsWith('https:')) return;
  setHeader(headers, 'sec-ch-ua', SEC_CH_UA);
  setHeader(headers, 'sec-ch-ua-mobile', '?0');
  setHeader(headers, 'sec-ch-ua-platform', '"Windows"');
  if (hasHeader(headers, 'sec-ch-ua-full-version-list')) setHeader(headers, 'sec-ch-ua-full-version-list', SEC_CH_UA_FULL);
  if (hasHeader(headers, 'sec-ch-ua-full-version')) setHeader(headers, 'sec-ch-ua-full-version', `"${FULL}"`);
  if (hasHeader(headers, 'sec-ch-ua-platform-version')) setHeader(headers, 'sec-ch-ua-platform-version', `"${PLATFORM_VERSION}"`);
  if (hasHeader(headers, 'sec-ch-ua-arch')) setHeader(headers, 'sec-ch-ua-arch', '"x86"');
  if (hasHeader(headers, 'sec-ch-ua-bitness')) setHeader(headers, 'sec-ch-ua-bitness', '"64"');
  if (hasHeader(headers, 'sec-ch-ua-model')) setHeader(headers, 'sec-ch-ua-model', '""');
  if (hasHeader(headers, 'sec-ch-ua-wow64')) setHeader(headers, 'sec-ch-ua-wow64', '?0');
  if (hasHeader(headers, 'sec-ch-ua-form-factors')) setHeader(headers, 'sec-ch-ua-form-factors', '"Desktop"');
}

const wired = new WeakSet();
const extraHooks = new WeakMap();

function wireSession(ses) {
  if (!ses || wired.has(ses)) return;
  wired.add(ses);
  try { ses.setUserAgent(UA); } catch (e) {}
  try {
    ses.webRequest.onBeforeSendHeaders((details, callback) => {
      const headers = details.requestHeaders;
      fixRequestHeaders(details, headers);
      const extra = extraHooks.get(ses);
      if (extra) { try { extra(details, headers); } catch (e) {} }
      callback({ requestHeaders: headers });
    });
  } catch (e) {}
  try {
    if (typeof ses.registerPreloadScript === 'function') {
      ses.registerPreloadScript({ id: 'kortex-chrome-spoof', type: 'frame', filePath: SPOOF_PATH });
    } else {
      const current = (ses.getPreloads && ses.getPreloads()) || [];
      ses.setPreloads(current.filter((p) => p !== SPOOF_PATH).concat([SPOOF_PATH]));
    }
  } catch (e) {}
}

function install(ses, extraHook) {
  const target = ses || session.defaultSession;
  if (typeof extraHook === 'function') extraHooks.set(target, extraHook);
  wireSession(target);
}

function applySession(ses) { wireSession(ses); }

app.on('session-created', (ses) => wireSession(ses));

function popupOptions(url) {
  if (!isGoogleAuthUrl(url)) return null;
  let sessionHasPreload = false;
  try { sessionHasPreload = typeof session.defaultSession.registerPreloadScript === 'function'; } catch (e) {}
  const webPreferences = { contextIsolation: true, nodeIntegration: false, sandbox: true };
  if (!sessionHasPreload) { webPreferences.preload = SPOOF_PATH; webPreferences.sandbox = false; }
  return {
    action: 'allow',
    overrideBrowserWindowOptions: {
      width: 520, height: 720, minWidth: 420, minHeight: 560,
      autoHideMenuBar: true, backgroundColor: '#202124', title: 'Iniciar sessão',
      webPreferences
    }
  };
}

module.exports = {
  UA, FULL, MAJOR, GREASE_BRAND, SEC_CH_UA, SEC_CH_UA_FULL, PLATFORM_VERSION, SPOOF_PATH,
  install, applySession, fixRequestHeaders, isGoogleHost, isGoogleAuthHost, isGoogleAuthUrl, popupOptions
};