// src/renderer/js/answer.js — página de resposta estilo Comet/Perplexity
(function () {
  const K = window.kortex;
  if (!K || !K.ai) return;

  const $ = (s) => document.querySelector(s);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  /* ---------- Markdown seguro, com tabelas ---------- */
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function inline(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a data-href="$2">$1</a>');
    return s;
  }
  const cells = (line) => {
    let s = line.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|')) s = s.slice(0, -1);
    return s.split('|').map((c) => c.trim());
  };
  function blocks(t) {
    const lines = t.split('\n');
    const out = []; let list = null; let para = [];
    const flushP = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
    const flushL = () => { if (list) { out.push('<' + list.t + '>' + list.items.map((i) => '<li>' + inline(i) + '</li>').join('') + '</' + list.t + '>'); list = null; } };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]; let m;
      if (!line.trim()) { flushP(); flushL(); continue; }
      const next = lines[i + 1];
      if (/^\s*\|/.test(line) && next && next.includes('-') && /^\s*\|?[\s:|-]+\|?\s*$/.test(next)) {
        flushP(); flushL();
        const head = cells(line); const rows = []; let j = i + 2;
        while (j < lines.length && /^\s*\|/.test(lines[j])) { rows.push(cells(lines[j])); j++; }
        out.push('<div class="tbl"><table><thead><tr>' + head.map((c) => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' +
          rows.map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>');
        i = j - 1; continue;
      }
      if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { flushP(); flushL(); out.push('<hr>'); continue; }
      if ((m = line.match(/^(#{1,6})\s+(.*)/))) { flushP(); flushL(); const tag = m[1].length <= 2 ? 'h3' : 'h4'; out.push('<' + tag + '>' + inline(m[2]) + '</' + tag + '>'); continue; }
      if ((m = line.match(/^\s*[-*]\s+(.*)/))) { flushP(); if (!list || list.t !== 'ul') { flushL(); list = { t: 'ul', items: [] }; } list.items.push(m[1]); continue; }
      if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) { flushP(); if (!list || list.t !== 'ol') { flushL(); list = { t: 'ol', items: [] }; } list.items.push(m[1]); continue; }
      flushL(); para.push(line);
    }
    flushP(); flushL();
    return out.join('');
  }
  function md(src) {
    return src.split('```').map((p, i) => {
      if (i % 2 === 1) { const nl = p.indexOf('\n'); const code = nl > -1 ? p.slice(nl + 1) : p; return '<pre><code>' + esc(code.replace(/\n$/, '')) + '</code></pre>'; }
      return blocks(p);
    }).join('');
  }
  window.KortexMd = md;

  /* ---------- Estado ---------- */
  const ICON_SEND = '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  const ICON_STOP = '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none"/></svg>';
  const state = { open: false, busy: null, history: [], tab: 'answer', tabId: null, sources: [], lastQ: '' };
  const turns = new Map();
  let activeId = null;
  let view, thread, linksBox, panel, input, sendBtn;

  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
  const openUrl = (u) => K.tabs.create(u);
  const scrollDown = (force) => {
    const sc = $('#ans-scroll');
    if (!sc) return;
    if (force || sc.scrollHeight - sc.scrollTop - sc.clientHeight < 160) sc.scrollTop = sc.scrollHeight;
  };
  const setBtn = (busy) => { sendBtn.innerHTML = busy ? ICON_STOP : ICON_SEND; sendBtn.classList.toggle('is-stop', busy); };

  function build() {
    if (view) return;
    view = h('section', 'ans-view');
    view.id = 'answer-view';
    view.hidden = true; // open() mostra-a
    view.innerHTML =
      '<div class="ans-top">' +
        '<button class="icon-btn icon-btn--sm" id="ans-back" type="button" title="Voltar ao início"><svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>' +
        '<nav class="ans-tabs">' +
          '<button type="button" data-t="answer" class="on">Resposta</button>' +
          '<button type="button" data-t="links">Ligações</button>' +
          '<button type="button" data-t="images">Imagens</button>' +
        '</nav><span class="ans-top-sp"></span>' +
      '</div>' +
      '<div class="ans-body">' +
        '<div class="ans-main">' +
          '<div class="ans-scroll" id="ans-scroll"><div class="ans-col" id="ans-thread"></div><div class="ans-col" id="ans-links" hidden></div></div>' +
          '<form class="ans-composer" id="ans-form"><textarea id="ans-input" rows="1" placeholder="Fazer uma pergunta de seguimento" spellcheck="false"></textarea><button type="submit" class="send-btn" id="ans-send"></button></form>' +
        '</div>' +
        '<aside class="ans-sources" id="ans-sources" hidden></aside>' +
      '</div>';
    $('#page-host').append(view);
    thread = $('#ans-thread'); linksBox = $('#ans-links'); panel = $('#ans-sources');
    input = $('#ans-input'); sendBtn = $('#ans-send');
    setBtn(false);

    view.addEventListener('click', (e) => { const a = e.target.closest('a[data-href]'); if (a) openUrl(a.dataset.href); });
    $('#ans-back').addEventListener('click', reset);
    view.querySelectorAll('.ans-tabs button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.t)));

    const grow = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; };
    input.addEventListener('input', grow);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#ans-form').requestSubmit(); } });
    $('#ans-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (state.busy) { K.ai.stop(state.busy); return; }
      const t = input.value.trim();
      if (!t) return;
      input.value = ''; grow();
      if (state.tab !== 'answer') setTab('answer');
      ask(t, { web: true });
    });
  }

  function setTab(t) {
    if (t === 'images') { if (state.lastQ) openUrl('https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(state.lastQ)); return; }
    state.tab = t;
    view.querySelectorAll('.ans-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    thread.hidden = t !== 'answer';
    linksBox.hidden = t !== 'links';
    $('.ans-composer').hidden = t !== 'answer';
    panel.classList.toggle('is-off', t !== 'answer');
    if (t === 'links') renderLinks();
  }

  function sourceCard(s) {
    const a = h('button', 'src-card');
    a.type = 'button';
    a.append(h('span', 'src-host', hostOf(s.url)), h('span', 'src-title', s.title || s.url));
    if (s.content) a.append(h('span', 'src-snip', s.content));
    a.addEventListener('click', () => openUrl(s.url));
    return a;
  }

  function renderPanel() {
    panel.replaceChildren();
    if (!state.sources.length) { panel.hidden = true; return; }
    panel.hidden = false;
    const head = h('button', 'src-head');
    head.type = 'button';
    head.append(h('span', '', 'Fontes'), h('span', 'src-count', String(state.sources.length)));
    const list = h('div', 'src-list');
    state.sources.forEach((s) => list.append(sourceCard(s)));
    head.addEventListener('click', () => list.classList.toggle('is-off'));
    panel.append(head, list);
  }

  function renderLinks() {
    linksBox.replaceChildren();
    if (!state.sources.length) { linksBox.append(h('div', 'ans-empty', 'Ainda não há ligações. Faz uma pergunta com a pesquisa ativa.')); return; }
    state.sources.forEach((s) => linksBox.append(sourceCard(s)));
  }

  function renderChips(t) {
    t.chips.replaceChildren();
    t.sources.slice(0, 6).forEach((s) => {
      const p = h('button', 'src-pill', hostOf(s.url));
      p.type = 'button';
      p.title = s.title || s.url;
      p.addEventListener('click', () => openUrl(s.url));
      t.chips.append(p);
    });
    if (t.sources.length > 6) t.chips.append(h('span', 'src-more', '+' + (t.sources.length - 6)));
  }

  /* ---------- Perguntar ---------- */
  function ask(text, { attachment = null, web = true } = {}) {
    if (state.busy) return;
    build();
    const id = 'ans-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    let content = text;
    if (attachment) content = [{ type: 'text', text: text || 'Analisa esta imagem.' }, { type: 'image_url', image_url: { url: attachment.base64 } }];

    const q = h('div', 'ans-q', text || '📷 Imagem anexada');
    const status = h('div', 'ans-status', web ? 'A pesquisar…' : 'A pensar…');
    const body = h('div', 'ans-a');
    const chips = h('div', 'ans-chips');
    thread.append(q, status, body, chips);
    scrollDown(true);

    const messages = [...state.history.slice(-16), { role: 'user', content }];
    state.history.push({ role: 'user', content: text || '[imagem]' });
    state.lastQ = text || state.lastQ;
    state.sources = [];
    renderPanel();
    turns.set(id, { status, body, chips, text: '', sources: [], t0: Date.now(), raf: 0, error: '' });
    state.busy = id;
    setBtn(true);
    K.chat({ chatId: id, messages, withPage: false, web })
      .catch((err) => { const t = turns.get(id); if (t) t.error = err.message || 'Erro desconhecido'; finish(id); });
  }

  function finish(id) {
    const t = turns.get(id);
    if (!t) return;
    cancelAnimationFrame(t.raf);
    const secs = Math.max(1, Math.round((Date.now() - t.t0) / 1000));
    if (t.text) {
      t.body.innerHTML = md(t.text);
      t.status.textContent = 'Concluído ' + secs + ' s';
      state.history.push({ role: 'assistant', content: t.text });
    } else {
      t.status.textContent = 'Sem resposta';
      state.history.pop();
    }
    if (t.error) { const e = h('div', 'ans-error', t.error); t.body.append(e); t.status.textContent = 'Erro'; }
    state.busy = null;
    setBtn(false);
    turns.delete(id);
    scrollDown();
  }

  K.ai.onChunk(({ chatId, delta }) => {
    const t = turns.get(chatId);
    if (!t) return;
    if (!t.text) t.status.textContent = 'A escrever…';
    t.text += delta;
    if (!t.raf) t.raf = requestAnimationFrame(() => { t.raf = 0; t.body.innerHTML = md(t.text); scrollDown(); });
  });
  if (K.ai.onSources) {
    K.ai.onSources(({ chatId, sources }) => {
      const t = turns.get(chatId);
      if (!t) return;
      (sources || []).forEach((s) => {
        if (!s || !s.url) return;
        if (!t.sources.some((x) => x.url === s.url)) t.sources.push(s);
        if (!state.sources.some((x) => x.url === s.url)) state.sources.push(s);
      });
      renderChips(t); renderPanel();
    });
  }
  K.ai.onError(({ chatId, error }) => { const t = turns.get(chatId); if (t) t.error = error; });
  K.ai.onDone(({ chatId }) => finish(chatId));

  /* ---------- Abrir / fechar ---------- */
  function open() {
    build();
    state.open = true;
    state.tabId = activeId;
    const hv = $('#home-view'); if (hv) hv.hidden = true;
    view.hidden = false;
  }
  function reset() {
    if (state.busy) K.ai.stop(state.busy);
    state.open = false; state.history = []; state.sources = []; state.lastQ = '';
    if (view) { thread.replaceChildren(); linksBox.replaceChildren(); panel.hidden = true; setTab('answer'); view.hidden = true; }
    const hv = $('#home-view'); if (hv) hv.hidden = false;
  }

  window.KortexAnswer = { start(text, opts) { if (!state.open) open(); ask(text, opts); }, reset };

  document.addEventListener('DOMContentLoaded', () => {
    K.tabs.onListUpdated(({ activeId: id }) => { activeId = id; });
    // O processo principal avisa antes de atualizar a lista de separadores, por isso decidimos com um pequeno atraso.
    K.tabs.onShowHome((show) => {
      setTimeout(() => {
        if (!view) return;
        const mine = show && state.open && activeId === state.tabId;
        view.hidden = !mine;
        const hv = $('#home-view');
        if (hv && show) hv.hidden = mine;
      }, 60);
    });
    const nc = $('#nav-new-chat');
    if (nc) nc.addEventListener('click', reset);
  });
})();
