// src/renderer/js/appearance.js — aplica as definições de Aspeto na interface, em tempo real.
// É o ÚNICO sítio que altera a aparência: os restantes scripts só gravam a definição.
(function () {
  const S = window.kortexSettings;
  if (!S) return;

  const root = document.documentElement;
  const $ = (s) => document.querySelector(s);
  const FONTS = {
    segoe: '"Segoe UI", system-ui, sans-serif',
    inter: '"Inter", "Segoe UI", system-ui, sans-serif',
    system: 'system-ui, -apple-system, sans-serif',
    mono: 'Consolas, "Cascadia Code", monospace'
  };

  const apply = {
    'appearance.accent': (v) => {
      if (!/^#[0-9a-f]{6}$/i.test(v)) return;
      root.style.setProperty('--accent-color', v);
      root.style.setProperty('--accent-hover', v + 'cc');
      root.style.setProperty('--accent-soft', v + '24');
    },
    'appearance.font': (v) => root.style.setProperty('--font-body', FONTS[v] || FONTS.segoe),
    'appearance.compact': (v) => {
      root.style.setProperty('--tabs-height', v ? '36px' : '42px');
      root.style.setProperty('--toolbar-height', v ? '40px' : '46px');
    },
    'appearance.bookmarksBar': (v) => { const b = $('#bookmarks-bar'); if (b) b.hidden = !v; },
    'appearance.showAssistantBtn': (v) => { const b = $('#btn-assistant'); if (b) b.hidden = !v; },
    'appearance.sidebarCollapsed': (v) => { $('#sidebar')?.classList.toggle('collapsed', !!v); },
    'appearance.reduceMotion': (v) => root.classList.toggle('reduce-motion', !!v),
    'appearance.showGreeting': (v) => { const g = $('.greeting'); if (g) g.hidden = !v; },
    'appearance.homeBackground': (v) => { $('#home-view')?.classList.toggle('home-glow', v === 'glow'); },
    'appearance.chatFontSize': (v) => root.style.setProperty('--chat-font-size', v + 'px')
  };

  const run = (key, value) => {
    if (!apply[key] || value === undefined) return;
    try { apply[key](value); } catch (e) { console.error('[appearance]', key, e); }
  };

  document.addEventListener('DOMContentLoaded', () => {
    S.getAll().then((all) => Object.keys(apply).forEach((k) => run(k, all[k]))).catch(() => { /* sem definições: fica o padrão */ });
    S.onChanged(({ key, value }) => run(key, value));
  });
})();
