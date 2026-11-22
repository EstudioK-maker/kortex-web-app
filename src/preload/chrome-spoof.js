'use strict';
const { contextBridge, webFrame } = require('electron');

(function () {
  try { if (!/^(https?|about):$/.test(location.protocol)) return; } catch (e) { return; }
  if (globalThis.__kortexSpoofDone) return;
  globalThis.__kortexSpoofDone = true;

  let FULL = '131.0.0.0';
  try { if (process.versions && process.versions.chrome) FULL = process.versions.chrome; } catch (e) {}
  const MAJOR = Number(String(FULL).split('.')[0]) || 131;

  const GC = [' ', '(', ':', '-', '.', '/', ')', ';', '=', '?', '_'];
  const GV = ['8', '99', '24'];
  const ORDERS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  function brandList(seed, version, full) {
    const brand = 'Not' + GC[seed % 11] + 'A' + GC[(seed + 1) % 11] + 'Brand';
    const gv = GV[seed % 3];
    const o = ORDERS[seed % 6];
    const l = [];
    l[o[0]] = { brand: brand, version: full ? gv + '.0.0.0' : gv };
    l[o[1]] = { brand: 'Chromium', version: version };
    l[o[2]] = { brand: 'Google Chrome', version: version };
    return l;
  }

  const data = {
    major: MAJOR, full: FULL,
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' + MAJOR + '.0.0.0 Safari/537.36',
    platform: 'Windows', platformVersion: '15.0.0',
    brands: brandList(MAJOR, String(MAJOR), false),
    fullList: brandList(MAJOR, FULL, true)
  };

  function mainWorld(d) {
    'use strict';
    var fakes = new WeakMap();
    var nativeToString = Function.prototype.toString;
    var tsProxy = new Proxy(nativeToString, {
      apply: function (t, self, args) {
        if (fakes.has(self)) return fakes.get(self);
        return Reflect.apply(t, self, args);
      }
    });
    Object.defineProperty(Function.prototype, 'toString', { value: tsProxy, writable: true, configurable: true, enumerable: false });
    fakes.set(tsProxy, 'function toString() { [native code] }');

    function mask(fn, name) { fakes.set(fn, 'function ' + name + '() { [native code] }'); return fn; }
    function getter(prop, fn) {
      var g = Object.getOwnPropertyDescriptor({ get [prop]() { return fn.call(this); } }, prop).get;
      return mask(g, 'get ' + prop);
    }
    function method(name, len, fn) {
      var m = ({ [name]() { return fn.apply(this, arguments); } })[name];
      Object.defineProperty(m, 'length', { value: len, configurable: true });
      return mask(m, name);
    }
    function clone(list) { return list.map(function (b) { return { brand: b.brand, version: b.version }; }); }
    function freezeList(list) { return Object.freeze(list.map(function (b) { return Object.freeze({ brand: b.brand, version: b.version }); })); }

    try {
      if (window.isSecureContext && typeof NavigatorUAData !== 'undefined') {
        var P = NavigatorUAData.prototype;
        var brands = freezeList(d.brands);
        Object.defineProperty(P, 'brands', { get: getter('brands', function () { return brands; }), set: undefined, enumerable: true, configurable: true });
        Object.defineProperty(P, 'mobile', { get: getter('mobile', function () { return false; }), set: undefined, enumerable: true, configurable: true });
        Object.defineProperty(P, 'platform', { get: getter('platform', function () { return d.platform; }), set: undefined, enumerable: true, configurable: true });
        var HINTS = ['architecture', 'bitness', 'formFactors', 'fullVersionList', 'model', 'platformVersion', 'uaFullVersion', 'wow64', 'brands', 'mobile', 'platform'];
        var ghev = method('getHighEntropyValues', 1, function (hints) {
          if (!(this instanceof NavigatorUAData)) return Promise.reject(new TypeError("Illegal invocation"));
          if (arguments.length === 0) return Promise.reject(new TypeError("1 argument required"));
          var all = { architecture: 'x86', bitness: '64', formFactors: ['Desktop'], fullVersionList: clone(d.fullList), model: '', platformVersion: d.platformVersion, uaFullVersion: d.full, wow64: false };
          var out = { brands: clone(d.brands), mobile: false, platform: d.platform };
          var list = Array.prototype.slice.call(hints || []);
          for (var i = 0; i < list.length; i++) {
            var k = String(list[i]);
            if (HINTS.indexOf(k) !== -1 && Object.prototype.hasOwnProperty.call(all, k)) out[k] = all[k];
          }
          return Promise.resolve(out);
        });
        Object.defineProperty(P, 'getHighEntropyValues', { value: ghev, writable: true, enumerable: true, configurable: true });
        var tj = method('toJSON', 0, function () { return { brands: clone(d.brands), mobile: false, platform: d.platform }; });
        Object.defineProperty(P, 'toJSON', { value: tj, writable: true, enumerable: true, configurable: true });
      }
    } catch (e) {}

    try {
      var NP = Navigator.prototype;
      var patchNav = function (prop, want) {
        try { if (navigator[prop] === want) return; Object.defineProperty(NP, prop, { get: getter(prop, function () { return want; }), set: undefined, enumerable: true, configurable: true }); } catch (e) {}
      };
      patchNav('userAgent', d.ua);
      patchNav('appVersion', d.ua.slice(8));
      patchNav('platform', 'Win32');
      patchNav('vendor', 'Google Inc.');
      patchNav('webdriver', false);
    } catch (e) {}

    try {
      var existing = (window.chrome && typeof window.chrome === 'object') ? window.chrome : null;
      var needs = !existing || typeof existing.loadTimes !== 'function' || typeof existing.csi !== 'function' || !existing.app;
      if (needs) {
        var perfNav = function () { try { return performance.getEntriesByType('navigation')[0] || null; } catch (e) { return null; } };
        var T = function (ms) { return (performance.timeOrigin + (ms || 0)) / 1000; };
        var loadTimes = method('loadTimes', 0, function () {
          var n = perfNav(), proto = (n && n.nextHopProtocol) || 'h2', paint = 0;
          try { var p = performance.getEntriesByName('first-paint')[0]; paint = p ? T(p.startTime) : 0; } catch (e) {}
          var spdy = /^h[23]/.test(proto);
          return { requestTime: T(n ? n.requestStart : 0), startLoadTime: T(n ? n.fetchStart : 0), commitLoadTime: T(n ? n.responseStart : 0), finishDocumentLoadTime: n && n.domContentLoadedEventEnd ? T(n.domContentLoadedEventEnd) : 0, finishLoadTime: n && n.loadEventEnd ? T(n.loadEventEnd) : 0, firstPaintTime: paint, firstPaintAfterLoadTime: 0, navigationType: 'Other', wasFetchedViaSpdy: spdy, wasNpnNegotiated: spdy, npnNegotiatedProtocol: proto, wasAlternateProtocolAvailable: false, connectionInfo: proto };
        });
        var csi = method('csi', 0, function () { var n = perfNav(); return { onloadT: n && n.loadEventEnd ? Math.round(performance.timeOrigin + n.loadEventEnd) : 0, startE: Math.round(performance.timeOrigin), pageT: performance.now(), tran: 15 }; });
        var app = { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, RunningState: { CANNOT_RUN: 'cannot_run' }, getDetails: method('getDetails', 0, function () { return null; }), getIsInstalled: method('getIsInstalled', 0, function () { return false; }), runningState: method('runningState', 0, function () { return 'cannot_run'; }) };
        var obj = existing || {};
        var define = function (k, v) { Object.defineProperty(obj, k, { value: v, writable: true, enumerable: true, configurable: true }); };
        if (typeof obj.loadTimes !== 'function') define('loadTimes', loadTimes);
        if (typeof obj.csi !== 'function') define('csi', csi);
        if (!obj.app) define('app', app);
        if (!existing) Object.defineProperty(window, 'chrome', { value: obj, writable: true, enumerable: true, configurable: true });
      }
    } catch (e) {}

    try {
      var SOFT = /swiftshader|llvmpipe|software|mesa/i;
      var patchGL = function (Ctor) {
        if (typeof Ctor === 'undefined') return;
        var orig = Ctor.prototype.getParameter;
        var proxy = new Proxy(orig, {
          apply: function (t, self, args) {
            var r = Reflect.apply(t, self, args);
            if ((args[0] === 37445 || args[0] === 37446) && typeof r === 'string' && SOFT.test(r)) {
              return args[0] === 37445 ? 'Google Inc. (NVIDIA)' : 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)';
            }
            return r;
          }
        });
        mask(proxy, 'getParameter');
        Object.defineProperty(Ctor.prototype, 'getParameter', { value: proxy, writable: true, enumerable: true, configurable: true });
      };
      patchGL(window.WebGLRenderingContext);
      patchGL(window.WebGL2RenderingContext);
    } catch (e) {}
  }

  try { contextBridge.executeInMainWorld({ func: mainWorld, args: [data] }); }
  catch (e) { try { webFrame.executeJavaScript('(' + mainWorld.toString() + ')(' + JSON.stringify(data) + ');', false); } catch (e2) {} }
})();

// --- Spotify Web Player Fix ---
try {
  const originalUserAgent = navigator.userAgent;
  const cleanUserAgent = originalUserAgent.replace(/Electron\/[\d.]+/, '').replace(/Kortex\/[\d.]+/, '').trim();
  Object.defineProperty(navigator, 'userAgent', { get: () => cleanUserAgent, configurable: true });
  console.log('[Kortex] User-Agent ajustado para Spotify Web Player.');
} catch (e) { console.error('[Kortex] Falha ao ajustar User-Agent:', e); }
// ------------------------------
