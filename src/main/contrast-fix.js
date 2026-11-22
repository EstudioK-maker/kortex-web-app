'use strict';

const CONTRAST_FIX_HOSTS = ['workspace.google.com', 'mail.google.com'];

function contrastFix() {
  var KEY = Symbol.for('kx.contrast');
  if (document[KEY]) return document[KEY]();

  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  var LIGHT = '#e8eaed';
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1 };
  var COLOR_RE = /(rgba?|color|lab|lch|oklab|oklch|hsla?|hwb)\([^)]*\)/g;
  var fixed = new Map();

  var cx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  cx.canvas.width = 1; cx.canvas.height = 1;
  function parse(c) {
    if (!c) return null;
    if (c === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    var m = /^rgba?\(([^)]+)\)$/.exec(c);
    if (m) {
      var p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }
    try {
      cx.clearRect(0, 0, 1, 1);
      cx.fillStyle = '#000'; cx.fillStyle = c;
      cx.fillRect(0, 0, 1, 1);
      var d = cx.getImageData(0, 0, 1, 1).data;
      return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    } catch (e) { return null; }
  }
  function lin(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function lum(c) { return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b); }
  function ratio(a, b) {
    var l1 = lum(a), l2 = lum(b);
    if (l1 < l2) { var t = l1; l1 = l2; l2 = t; }
    return (l1 + 0.05) / (l2 + 0.05);
  }
  function over(f, b) {
    var a = f.a;
    return { r: f.r * a + b.r * (1 - a), g: f.g * a + b.g * (1 - a), b: f.b * a + b.b * (1 - a), a: 1 };
  }
  function clipsText(cs) { return (cs.webkitBackgroundClip || cs.backgroundClip) === 'text'; }

  function up(n) {
    if (n.parentElement) return n.parentElement;
    var r = n.getRootNode && n.getRootNode();
    return r && r.host ? r.host : null;
  }

  function bgOf(el, skipSelf) {
    var layers = [], base = null;
    for (var n = skipSelf ? up(el) : el; n && n.nodeType === 1; n = up(n)) {
      var cs = getComputedStyle(n);
      var c = parse(cs.backgroundColor);
      if (c && c.a >= 0.95) { base = c; break; }
      if (c && c.a > 0) layers.push(c);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        var stops = (cs.backgroundImage.match(COLOR_RE) || []).map(parse).filter(Boolean);
        var solid = stops.filter(function (s) { return s.a >= 0.95; });
        if (solid.length) {
          var sum = { r: 0, g: 0, b: 0 };
          solid.forEach(function (s) { sum.r += s.r; sum.g += s.g; sum.b += s.b; });
          base = { r: sum.r / solid.length, g: sum.g / solid.length, b: sum.b / solid.length, a: 1 };
          break;
        }
      }
    }
    if (!base) base = { r: 32, g: 33, b: 36, a: 1 };
    for (var i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  }

  function fgOf(cs, bg) {
    var fill = parse(cs.webkitTextFillColor);
    if (clipsText(cs) || (fill && fill.a === 0)) {
      var stops = (cs.backgroundImage.match(COLOR_RE) || []).map(parse).filter(Boolean);
      if (!stops.length) return null;
      var best = over(stops[0], bg);
      for (var i = 1; i < stops.length; i++) {
        var s = over(stops[i], bg);
        if (lum(s) > lum(best)) best = s;
      }
      return best;
    }
    var c = (fill && fill.a > 0) ? fill : parse(cs.color);
    if (!c || c.a === 0) return null;
    return over(c, bg);
  }

  function collect(root, out) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    var node, count = 0;
    while ((node = w.nextNode()) && count++ < 40000) {
      if (node.nodeType === 1) { if (node.shadowRoot) collect(node.shadowRoot, out); continue; }
      var t = node.nodeValue;
      if (!t || !t.trim()) continue;
      var p = node.parentElement;
      if (!p || SKIP[p.tagName]) continue;
      out.add(p);
    }
  }

  function put(el, prop, v) { if (v) el.style.setProperty(prop, v); else el.style.removeProperty(prop); }
  function restore() {
    fixed.forEach(function (orig, el) {
      put(el, 'color', orig[0]);
      put(el, '-webkit-text-fill-color', orig[1]);
    });
    fixed.clear();
  }

  function run() {
    if (!mq.matches) { restore(); return { fixed: 0, scanned: 0, dark: false }; }
    fixed.forEach(function (_, el) { if (!el.isConnected) fixed.delete(el); });

    var parents = new Set();
    collect(document.documentElement, parents);

    var scanned = 0;
    parents.forEach(function (el) {
      if (fixed.has(el)) return;
      scanned++;
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;
      var bg = bgOf(el, clipsText(cs));
      if (lum(bg) > 0.2) return;
      var fg = fgOf(cs, bg);
      if (!fg) return;
      var googleDark = Math.round(fg.r) === 32 && Math.round(fg.g) === 33 && Math.round(fg.b) === 36;
      if (googleDark || ratio(fg, bg) < 3) {
        fixed.set(el, [el.style.getPropertyValue('color'), el.style.getPropertyValue('-webkit-text-fill-color')]);
        el.style.setProperty('color', LIGHT, 'important');
        el.style.setProperty('-webkit-text-fill-color', LIGHT, 'important');
      }
    });
    return { fixed: fixed.size, scanned: scanned, dark: true };
  }

  var timer = null;
  function schedule() { clearTimeout(timer); timer = setTimeout(run, 150); }

  Object.defineProperty(document, KEY, { value: run, configurable: true });
  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['class']
  });
  if (mq.addEventListener) mq.addEventListener('change', run);
  window.addEventListener('load', schedule, { once: true });
  window.addEventListener('scroll', schedule, { passive: true });
  [500, 1500, 3000].forEach(function (ms) { setTimeout(run, ms); });
  return run();
}

function applyContrastFix(wc) {
  try {
    if (!wc || wc.isDestroyed()) return;
    const host = new URL(wc.getURL()).hostname;
    if (!CONTRAST_FIX_HOSTS.includes(host)) return;
    wc.executeJavaScript('(' + contrastFix.toString() + ')()')
      .then((r) => { if (process.env.KORTEX_DEBUG) console.log('[contrastFix]', host, r); })
      .catch((e) => { if (process.env.KORTEX_DEBUG) console.error('[contrastFix]', e); });
  } catch (e) {}
}

module.exports = { applyContrastFix, contrastFix, CONTRAST_FIX_HOSTS };