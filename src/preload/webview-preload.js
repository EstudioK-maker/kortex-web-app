'use strict';
// Preload das abas.
// 1) Paginas internas kortex:// (Definicoes, Historico, Extensoes...) recebem a API window.kortex.
// 2) Nos outros sites, bloqueia o popup de passkey / chave de seguranca do Windows.
if (location.protocol === 'kortex:') {
  if (window.top === window) {
    try { require('./preload.js'); } catch (e) { console.error('[webview-preload] API kortex:', e); }
  }
} else if (!/(^|\.)(google\.com|youtube\.com)$/i.test(location.hostname)) {
  try {
    require('electron').webFrame.executeJavaScript(`(function(){
      try {
        var deny = function(){ return Promise.reject(new DOMException('The operation either timed out or was not allowed.', 'NotAllowedError')); };
        if (navigator.credentials) {
          var c = navigator.credentials;
          var og = c.get ? c.get.bind(c) : null, oc = c.create ? c.create.bind(c) : null;
          c.get = function(o){ return (o && o.publicKey) ? deny() : (og ? og(o) : Promise.resolve(null)); };
          c.create = function(o){ return (o && o.publicKey) ? deny() : (oc ? oc(o) : Promise.resolve(null)); };
        }
        if (window.PublicKeyCredential) {
          PublicKeyCredential.isConditionalMediationAvailable = function(){ return Promise.resolve(false); };
          PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = function(){ return Promise.resolve(false); };
        }
      } catch (e) {}
    })();`);
  } catch (e) {}
}

// kortex-brands-fix: adiciona "Google Chrome" ao userAgentData (coerente com o cabecalho sec-ch-ua)
if (location.protocol !== 'kortex:') {
  try {
    require('electron').webFrame.executeJavaScript(`(function(){
      try {
        var ud = navigator.userAgentData; if (!ud) return;
        var m = (navigator.userAgent.match(/Chrome\\/(\\d+)/) || [])[1] || '131';
        var brands = ud.brands.map(function(b){ return { brand: b.brand, version: b.version }; });
        if (!brands.some(function(b){ return b.brand === 'Google Chrome'; })) brands.push({ brand: 'Google Chrome', version: m });
        var origHigh = ud.getHighEntropyValues ? ud.getHighEntropyValues.bind(ud) : null;
        Object.defineProperty(ud, 'brands', { get: function(){ return brands.map(function(b){ return { brand: b.brand, version: b.version }; }); }, configurable: true });
        if (origHigh) {
          Object.defineProperty(ud, 'getHighEntropyValues', { configurable: true, writable: true, value: function(h){
            return origHigh(h).then(function(r){
              try {
                if (r.brands) r.brands = brands.map(function(b){ return { brand: b.brand, version: b.version }; });
                if (r.fullVersionList) {
                  var fl = r.fullVersionList.slice();
                  if (!fl.some(function(b){ return b.brand === 'Google Chrome'; })) {
                    var c = fl.filter(function(b){ return b.brand === 'Chromium'; })[0];
                    fl.push({ brand: 'Google Chrome', version: c ? c.version : m + '.0.0.0' });
                  }
                  r.fullVersionList = fl;
                }
              } catch (e) {}
              return r;
            });
          } });
        }
        Object.defineProperty(ud, 'toJSON', { configurable: true, writable: true, value: function(){ return { brands: brands, mobile: ud.mobile, platform: ud.platform }; } });
      } catch (e) {}
    })();`);
  } catch (e) {}
}
// kortex-store-bridge: expoe kortexStore.install so na Chrome Web Store
if (location.protocol === 'https:' && location.hostname === 'chromewebstore.google.com') {
  try {
    const { contextBridge, ipcRenderer } = require('electron');
    contextBridge.exposeInMainWorld('kortexStore', { install: (id) => ipcRenderer.invoke('store:install', id) });
  } catch (e) { console.error('[webview-preload] kortexStore:', e); }
}