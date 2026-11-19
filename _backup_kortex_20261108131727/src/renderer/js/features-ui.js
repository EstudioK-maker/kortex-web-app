// src/renderer/js/features-ui.js
(function () {
  const K = window.kortex;
  if (!K || !K.on) return;
  const $ = (s) => document.querySelector(s);
  const el = (tag, attrs = {}) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v); } return e; };
  let activeTab = null; let noteTimer = null;
  function note(msg) { const n = $('#toolbar-note'); if (!n) return; n.textContent = msg; n.classList.add('is-on'); clearTimeout(noteTimer); noteTimer = setTimeout(() => n.classList.remove('is-on'), 2500); }
  document.addEventListener('DOMContentLoaded', () => {
    const toolbar = $('#toolbar'); const urlInput = $('#url-input'); const actions = $('.toolbar-actions');
    if (!toolbar || !urlInput || !actions) return;
    actions.before(el('span', { id: 'toolbar-note', class: 'toolbar-note' }));
    const star = el('button', { class: 'icon-btn icon-btn--sm url-star', type: 'button', title: 'Adicionar aos marcadores (Ctrl+D)' });
    star.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.5 9.7l5.9-.9L12 3.5z"/></svg>';
    urlInput.after(star);
    star.addEventListener('click', async () => { if (!activeTab) return; const r = await K.bookmarks.toggle({ url: activeTab.url, title: activeTab.title }); note(r.ok ? (r.bookmarked ? 'Marcador adicionado' : 'Marcador removido') : 'Esta página não pode ser guardada'); });
    async function syncStar() { const on = !!(activeTab && activeTab.url && await K.bookmarks.isBookmarked(activeTab.url)); star.classList.toggle('is-on', on); }
    const bar = el('div', { id: 'bookmarks-bar', class: 'bookmarks-bar' }); toolbar.after(bar);
    async function renderBar() { const list = await K.bookmarks.list(); bar.replaceChildren(); if (!list.length) { bar.append(el('span', { class: 'bm-empty', text: 'Sem marcadores — carrega na estrela da barra de endereço (Ctrl+D).' })); return; } list.forEach((b) => { const btn = el('button', { class: 'bm-item', type: 'button', title: b.url, text: (b.title || b.url).slice(0, 26) }); btn.addEventListener('click', () => K.tabs.navigate('current', b.url)); btn.addEventListener('auxclick', (e) => { if (e.button === 1) K.tabs.create(b.url); }); btn.addEventListener('contextmenu', async (e) => { e.preventDefault(); if (confirm('Remover "' + (b.title || b.url) + '" dos marcadores?')) await K.bookmarks.remove(b.id); }); bar.append(btn); }); }
    function setBar(on) { bar.style.display = on ? 'flex' : 'none'; try { localStorage.setItem('kx-bmbar', on ? '1' : '0'); } catch {} }
    let barOn = false; try { barOn = localStorage.getItem('kx-bmbar') === '1'; } catch {} setBar(barOn); renderBar();
    const find = el('div', { id: 'find-bar', class: 'find-bar' });
    find.innerHTML = '<input id="find-input" placeholder="Procurar na página" spellcheck="false" autocomplete="off"><span id="find-count"></span><button class="icon-btn icon-btn--sm" id="find-prev" type="button" title="Anterior (Shift+Enter)">▲</button><button class="icon-btn icon-btn--sm" id="find-next" type="button" title="Seguinte (Enter)">▼</button><button class="icon-btn icon-btn--sm" id="find-close" type="button" title="Fechar (Esc)">✕</button>';
    bar.after(find);
    const fIn = find.querySelector('#find-input'); const fCount = find.querySelector('#find-count');
    const findOpen = () => find.style.display === 'flex';
    function openFind() { find.style.display = 'flex'; fIn.focus(); fIn.select(); if (fIn.value) K.find.start(fIn.value, { forward: true, next: false }); }
    function closeFind() { if (!findOpen()) return; find.style.display = 'none'; fCount.textContent = ''; K.find.stop(); }
    fIn.addEventListener('input', () => { if (fIn.value) K.find.start(fIn.value, { forward: true, next: false }); else { K.find.stop(); fCount.textContent = ''; } });
    fIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (fIn.value) K.find.start(fIn.value, { forward: !e.shiftKey, next: true }); } if (e.key === 'Escape') closeFind(); });
    find.querySelector('#find-next').addEventListener('click', () => fIn.value && K.find.start(fIn.value, { forward: true, next: true }));
    find.querySelector('#find-prev').addEventListener('click', () => fIn.value && K.find.start(fIn.value, { forward: false, next: true }));
    find.querySelector('#find-close').addEventListener('click', closeFind);
    const dl = el('button', { class: 'icon-btn dl-btn', id: 'btn-downloads', type: 'button', title: 'Transferências (Ctrl+J)' });
    dl.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg><i class="dl-dot"></i>';
    const anchor = $('#btn-private') || actions.firstChild;
    actions.insertBefore(dl, anchor);
    dl.addEventListener('click', () => { dl.classList.remove('has-new'); K.tabs.create('kortex://downloads'); });
    K.tabs.onListUpdated(({ tabs, activeId }) => {
      activeTab = tabs.find((t) => t.id === activeId) || null; syncStar();
      const els = document.querySelectorAll('#tab-strip .tab');
      tabs.forEach((t, i) => { const e = els[i]; if (!e) return; e.classList.toggle('is-pinned', !!t.pinned); e.addEventListener('contextmenu', (ev) => { ev.preventDefault(); K.tabs.context(t.id); }); e.addEventListener('auxclick', (ev) => { if (ev.button === 1) { ev.preventDefault(); K.tabs.close(t.id); } }); const brand = e.querySelector('.tab__brand'); if (brand && (t.loading || t.favicon)) { if (t.loading) brand.replaceWith(el('span', { class: 'tab__spinner' })); else { const img = el('img', { class: 'tab__favicon', src: t.favicon, alt: '' }); img.addEventListener('error', () => { img.style.display = 'none'; }); brand.replaceWith(img); } } if (t.audible || t.muted) { const a = el('span', { class: 'tab__audio', text: t.muted ? '🔇' : '🔊' }); const title = e.querySelector('.tab__title'); if (title) title.after(a); } });
    });
    K.on('toast', note);
    K.on('focus-url', () => { urlInput.focus(); urlInput.select(); });
    K.on('assistant:toggle', () => { const b = $('#btn-assistant'); if (b) b.click(); });
    K.on('assistant:ask', ({ text, withTabs }) => { if (window.KortexChat) window.KortexChat.ask(text, { withTabs }); });
    K.on('bookmarks:changed', () => { renderBar(); syncStar(); });
    K.on('bookmarks:toggle-bar', () => setBar(bar.style.display === 'none'));
    K.on('find:open', openFind);
    K.on('find:close', closeFind);
    K.on('find:result', ({ active, total }) => { fCount.textContent = total ? active + '/' + total : 'Sem resultados'; });
    K.on('downloads:updated', (d) => { dl.classList.toggle('is-busy', d.state === 'progressing'); if (d.state === 'completed') dl.classList.add('has-new'); });
  });
})();