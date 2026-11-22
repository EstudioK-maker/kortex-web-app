// src/renderer/js/features-ui.js — marcadores, pesquisa na página (Ctrl+F), transferências e avisos da barra.
// Os elementos já existem no index.html; aqui só se liga o comportamento.
(function () {
  const K = window.kortex;
  const S = window.kortexSettings;
  if (!K || !K.on) return;

  const $ = (s) => document.querySelector(s);
  const make = (tag, props = {}) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) { if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v); }
    return e;
  };

  document.addEventListener('DOMContentLoaded', () => {
    let activeTab = null;
    let noteTimer = 0;

    /* --- Nota temporária na barra (zoom, marcador, download...) --- */
    const noteEl = $('#toolbar-note');
    function note(msg) {
      if (!noteEl) return;
      noteEl.textContent = msg;
      noteEl.hidden = false;
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => { noteEl.hidden = true; }, 2500);
    }

    /* --- Estrela de marcadores --- */
    const star = $('#btn-star');
    async function syncStar() {
      const on = !!(activeTab && activeTab.url && await K.bookmarks.isBookmarked(activeTab.url));
      star?.classList.toggle('is-on', on);
    }
    star?.addEventListener('click', async () => {
      if (!activeTab) return;
      const r = await K.bookmarks.toggle({ url: activeTab.url, title: activeTab.title });
      note(r.ok ? (r.bookmarked ? 'Marcador adicionado' : 'Marcador removido') : 'Esta página não pode ser guardada');
    });
    K.tabs.onListUpdated(({ tabs, activeId }) => { activeTab = tabs.find((t) => t.id === activeId) || null; syncStar(); });

    /* --- Barra de marcadores (a visibilidade vem da definição appearance.bookmarksBar) --- */
    const bar = $('#bookmarks-bar');
    async function renderBar() {
      if (!bar) return;
      const list = await K.bookmarks.list();
      bar.replaceChildren();
      if (!list.length) { bar.append(make('span', { class: 'bm-empty', text: 'Sem marcadores — carrega na estrela da barra de endereço (Ctrl+D).' })); return; }
      list.forEach((b) => {
        const btn = make('button', { class: 'bm-item', type: 'button', title: b.url, text: (b.title || b.url).slice(0, 26) });
        btn.addEventListener('click', () => K.tabs.navigate('current', b.url));
        btn.addEventListener('auxclick', (e) => { if (e.button === 1) K.tabs.create(b.url); });
        btn.addEventListener('contextmenu', async (e) => {
          e.preventDefault();
          if (confirm('Remover "' + (b.title || b.url) + '" dos marcadores?')) await K.bookmarks.remove(b.id);
        });
        bar.append(btn);
      });
    }
    renderBar();
    K.on('bookmarks:changed', () => { renderBar(); syncStar(); });
    K.on('bookmarks:toggle-bar', async () => S.set('appearance.bookmarksBar', !(await S.get('appearance.bookmarksBar'))));

    /* --- Pesquisa na página (Ctrl+F) --- */
    const find = $('#find-bar');
    const fIn = $('#find-input');
    const fCount = $('#find-count');
    const openFind = () => { find.hidden = false; fIn.focus(); fIn.select(); if (fIn.value) K.find.start(fIn.value, { forward: true, next: false }); };
    const closeFind = () => { if (find.hidden) return; find.hidden = true; fCount.textContent = ''; K.find.stop(); };
    fIn.addEventListener('input', () => {
      if (fIn.value) K.find.start(fIn.value, { forward: true, next: false });
      else { K.find.stop(); fCount.textContent = ''; }
    });
    fIn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); if (fIn.value) K.find.start(fIn.value, { forward: !e.shiftKey, next: true }); }
      if (e.key === 'Escape') closeFind();
    });
    $('#find-next').addEventListener('click', () => fIn.value && K.find.start(fIn.value, { forward: true, next: true }));
    $('#find-prev').addEventListener('click', () => fIn.value && K.find.start(fIn.value, { forward: false, next: true }));
    $('#find-close').addEventListener('click', closeFind);
    K.on('find:open', openFind);
    K.on('find:close', closeFind);
    K.on('find:result', ({ active, total }) => { fCount.textContent = total ? active + '/' + total : 'Sem resultados'; });

    /* --- Transferências --- */
    // openInternal reaproveita o separador atual se estiver em branco e, caso contrário, abre um novo
    // (a mesma regra do Ctrl+J). O processo principal aplica os limites da página ao separador novo.
    const dl = $('#btn-downloads');
    dl?.addEventListener('click', () => { dl.classList.remove('has-new'); K.tabs.openInternal('kortex://downloads'); });
    K.on('downloads:updated', (d) => {
      dl?.classList.toggle('is-busy', d.state === 'progressing');
      if (d.state === 'completed') dl?.classList.add('has-new');
    });

    /* --- Outros eventos do processo principal --- */
    K.on('toast', note);
    K.on('focus-url', () => { const u = $('#url-input'); u.focus(); u.select(); });
    K.on('assistant:toggle', () => $('#btn-assistant')?.click());
    K.on('assistant:ask', ({ text, withTabs }) => window.KortexChat?.ask(text, { withTabs }));
  });
})();
