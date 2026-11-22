(function () {
  const K = window.kortex;
  if (!K || !K.ai) return;

  const ICON_SEND = '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  const ICON_STOP = '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none"/></svg>';
  const ICON_EMPTY = '<svg class="empty-chat-icon" viewBox="0 0 48 48"><path d="M8 11a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H22l-8 7v-7h-2a4 4 0 0 1-4-4V11z"/></svg>';
  const ICON_CLIP = '<svg viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
  const ICON_IMAGE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><path d="M21 15l-5-5L5 21"/></svg>';

  const $ = (s) => document.querySelector(s);
  const h = (tag, props = {}) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) { if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v); }
    return e;
  };

  /* ---------- Markdown seguro ---------- */
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function inline(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a data-href="$2">$1</a>');
    return s;
  }
  function blocks(t) {
    const out = []; let list = null; let para = [];
    const flushP = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
    const flushL = () => { if (list) { out.push('<' + list.t + '>' + list.items.map((i) => '<li>' + inline(i) + '</li>').join('') + '</' + list.t + '>'); list = null; } };
    for (const line of t.split('\n')) {
      let m;
      if (!line.trim()) { flushP(); flushL(); continue; }
      if ((m = line.match(/^#{1,4}\s+(.*)/))) { flushP(); flushL(); out.push('<h4>' + inline(m[1]) + '</h4>'); continue; }
      if ((m = line.match(/^\s*[-*]\s+(.*)/))) { flushP(); if (!list || list.t !== 'ul') { flushL(); list = { t: 'ul', items: [] }; } list.items.push(m[1]); continue; }
      if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) { flushP(); if (!list || list.t !== 'ol') { flushL(); list = { t: 'ol', items: [] }; } list.items.push(m[1]); continue; }
      flushL(); para.push(line);
    }
    flushP(); flushL();
    return out.join('');
  }
  function mdOld(src) {
    return src.split('```').map((p, i) => {
      if (i % 2 === 1) { const nl = p.indexOf('\n'); const code = nl > -1 ? p.slice(nl + 1) : p; return '<pre><code>' + esc(code.replace(/\n$/, '')) + '</code></pre>'; }
      return blocks(p);
    }).join('');
  }
  const md = (s) => (window.KortexMd ? window.KortexMd(s) : mdOld(s));

  /* ---------- Estado ---------- */
  const scopes = {
    home: { field: 'home-chat-field', btn: 'home-send', box: null, history: [], busy: null, withPage: false },
    assistant: { field: 'assistant-chat-field', btn: 'assistant-send', box: null, history: [], busy: null, withPage: true }
  };
  const chats = new Map();
  const attachments = { home: null, assistant: null };
  let mode = 'search';
  let fileInput = null;

  const scroll = (box, force) => { if (force || box.scrollHeight - box.scrollTop - box.clientHeight < 140) box.scrollTop = box.scrollHeight; };
  const setBtn = (s, busy) => {
    const b = document.getElementById(s.btn);
    if (!b) return;
    b.innerHTML = busy ? ICON_STOP : ICON_SEND;
    b.classList.toggle('is-stop', busy);
    b.title = busy ? 'Parar' : 'Enviar';
  };
  const attachBtnId = (name) => (name === 'home' ? 'home-attach' : 'assistant-attach');
  const setAttachBtn = (name, on) => {
    const a = document.getElementById(attachBtnId(name));
    if (a) a.classList.toggle('has-file', !!on);
  };

  /* ---------- Anexos (preview acima da caixa de texto) ---------- */
  function renderPreview(name) {
    const s = scopes[name];
    const field = document.getElementById(s.field);
    if (!field) return;
    let preview = document.getElementById('preview-' + name);
    if (!preview) {
      preview = document.createElement('div');
      preview.id = 'preview-' + name;
      preview.className = 'attachment-preview';
      field.parentElement.insertBefore(preview, field);
    }
    preview.innerHTML = '';
    const att = attachments[name];
    if (att) {
      preview.style.display = 'block';
      const img = document.createElement('img');
      img.src = att.base64;
      img.alt = 'Pré-visualização da imagem anexada';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'attachment-preview__remove';
      btn.innerHTML = '&times;';
      btn.title = 'Remover';
      btn.addEventListener('click', () => clearAttachment(name));
      preview.append(img, btn);
    } else {
      preview.style.display = 'none';
      preview.innerHTML = '';
    }
  }

  function clearAttachment(name) {
    attachments[name] = null;
    if (fileInput) { fileInput.value = ''; fileInput.dataset.target = ''; }
    setAttachBtn(name, false);
    renderPreview(name);
  }

  function renderEmpty() {
    const s = scopes.assistant;
    s.box.replaceChildren();
    const wrap = h('div', { class: 'chat-empty' });
    wrap.innerHTML = ICON_EMPTY;
    wrap.append(h('p', { text: 'Pergunta sobre esta página ou pede-me para a resumir.' }));
    [
      ['Resumir página', 'Resume esta página em pontos principais.'],
      ['Explicar de forma simples', 'Explica o conteúdo desta página de forma simples.'],
      ['Traduzir para português', 'Traduz o conteúdo principal desta página para português.'],
      ['Resumir todos os separadores', 'Resume o que está aberto em cada um dos meus separadores.', true]
    ].forEach(([label, prompt, tabs]) => {
      const b = h('button', { class: 'chat-chip', type: 'button', text: label });
      b.addEventListener('click', () => ask(prompt, { withTabs: !!tabs }));
      wrap.append(b);
    });
    s.box.append(wrap);
  }

  /* ---------- Enviar ---------- */
  function send(name, text, opts = {}) {
    const s = scopes[name];
    text = (text || '').trim();
    if (s.busy) return;
    if (!text && !attachments[name]) return;

    const attachment = attachments[name];
    clearAttachment(name);

    if (name === 'home' && window.KortexAnswer) {
      window.KortexAnswer.start(text, { attachment, web: mode === 'search' });
      return;
    }

    const empty = s.box.querySelector('.chat-empty');
    if (empty) empty.remove();

    const chatId = 'chat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    let content = text;
    if (attachment) {
      content = [
        { type: 'text', text: text || 'Analisa esta imagem.' },
        { type: 'image_url', image_url: { url: attachment.base64 } }
      ];
    }

    const userBubble = h('div', { class: 'msg user' });
    if (attachment) {
      const note = h('div', { class: 'msg-attachment' });
      note.innerHTML = ICON_IMAGE + '<span>Imagem anexada</span>';
      note.style.display = 'inline-flex';
      note.style.alignItems = 'center';
      note.style.gap = '6px';
      note.style.maxWidth = '100%';
      note.style.padding = '4px 10px';
      note.style.margin = '2px 0 8px';
      note.style.borderRadius = '999px';
      note.style.background = 'rgba(128, 128, 128, 0.18)';
      note.style.fontSize = '12px';
      note.style.lineHeight = '1.4';
      userBubble.append(note);
    }
    if (text) {
      const txt = document.createElement('div');
      txt.textContent = text;
      userBubble.append(txt);
    }
    const bot = h('div', { class: 'msg bot' });
    const body = h('div', { class: 'msg__content' });
    body.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    bot.append(body);
    s.box.append(userBubble, bot);
    scroll(s.box, true);

    const messages = [...s.history.slice(-16), { role: 'user', content }];
    s.history.push({ role: 'user', content: text || '[imagem]' });
    chats.set(chatId, { scope: name, bubble: bot, body, text: '', raf: 0, error: '' });
    s.busy = chatId;
    setBtn(s, true);

    K.chat({ chatId, messages, withPage: s.withPage, withTabs: !!opts.withTabs, mode: name === 'home' ? mode : 'search' })
      .catch((err) => { const c = chats.get(chatId); if (c) c.error = err.message || 'Erro desconhecido'; finalize(chatId); });
  }

  function ask(text, opts) {
    const p = document.getElementById('assistant-panel');
    if (p) p.classList.add('is-open');
    send('assistant', text, opts);
  }

  function finalize(chatId) {
    const c = chats.get(chatId);
    if (!c) return;
    cancelAnimationFrame(c.raf);
    const s = scopes[c.scope];
    if (c.text) c.body.innerHTML = md(c.text); else c.body.textContent = c.error ? '' : '(Sem resposta)';
    if (c.error) { c.bubble.append(h('div', { class: 'msg__error', text: c.error })); if (!c.text) s.history.pop(); }
    if (c.text) {
      s.history.push({ role: 'assistant', content: c.text });
      const actions = h('div', { class: 'msg__actions' });
      const copy = h('button', { type: 'button', text: 'Copiar' });
      copy.addEventListener('click', () => { navigator.clipboard.writeText(c.text).then(() => { copy.textContent = 'Copiado ✓'; setTimeout(() => (copy.textContent = 'Copiar'), 1500); }).catch(() => {}); });
      actions.append(copy);
      c.bubble.append(actions);
    }
    s.busy = null;
    setBtn(s, false);
    chats.delete(chatId);
    scroll(s.box);
  }

  /* ---------- Eventos da IA ---------- */
  K.ai.onChunk(({ chatId, delta }) => {
    const c = chats.get(chatId);
    if (!c) return;
    c.text += delta;
    if (!c.raf) c.raf = requestAnimationFrame(() => { c.raf = 0; c.body.innerHTML = md(c.text); scroll(scopes[c.scope].box); });
  });
  K.ai.onError(({ chatId, error }) => { const c = chats.get(chatId); if (c) c.error = error; });
  K.ai.onDone(({ chatId }) => finalize(chatId));

  /* ---------- Ligação ao DOM ---------- */
  function setup(name) {
    const s = scopes[name];
    const field = document.getElementById(s.field);
    const btn = document.getElementById(s.btn);
    if (!field || !btn) return;

    if (name === 'assistant') {
      s.box = document.getElementById('assistant-messages-box');
      const form = field.closest('form');
      const actions = form ? form.querySelector('.chat-input__actions') : null;
      if (actions && !document.getElementById('assistant-attach')) {
        const attachBtn = document.createElement('button');
        attachBtn.type = 'button';
        attachBtn.id = 'assistant-attach';
        attachBtn.className = 'icon-btn icon-btn--sm';
        attachBtn.title = 'Anexar imagem';
        attachBtn.innerHTML = ICON_CLIP;
        attachBtn.style.marginRight = '8px';
        attachBtn.addEventListener('click', (e) => {
          e.preventDefault();
          if (fileInput) {
            fileInput.dataset.target = 'assistant';
            fileInput.click();
          }
          setTimeout(() => field.focus(), 100);
        });
        actions.insertBefore(attachBtn, actions.firstChild);
      }
    } else {
      s.box = h('div', { id: 'home-messages-box' });
      field.closest('form').after(s.box);
    }
    if (!s.box) return;
    s.box.classList.add('chat-log');
    s.box.addEventListener('click', (e) => { const a = e.target.closest('a[data-href]'); if (a) K.tabs.create(a.dataset.href); });

    field.addEventListener('paste', (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type && item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (!blob) return;
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = (ev) => {
            attachments[name] = { type: blob.type, base64: ev.target.result };
            setAttachBtn(name, true);
            renderPreview(name);
            if (window.showKortexToast) window.showKortexToast('Imagem anexada da área de transferência');
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
    });

    const grow = () => { field.style.height = 'auto'; field.style.height = Math.min(field.scrollHeight, 140) + 'px'; };
    field.addEventListener('input', grow);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (s.busy) { K.ai.stop(s.busy); return; }
      const t = field.value;
      if (!t.trim() && !attachments[name]) return;
      field.value = ''; grow();
      send(name, t);
    });
    field.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!s.busy) btn.click(); }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setup('home');
    setup('assistant');
    if (scopes.assistant.box) renderEmpty();

    const close = document.getElementById('assistant-close');
    if (close && !close.parentElement.classList.contains('hdr-actions')) {
      const wrap = h('div', { class: 'hdr-actions' });
      const nb = h('button', { class: 'icon-btn icon-btn--sm', type: 'button', title: 'Nova conversa' });
      nb.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
      nb.addEventListener('click', () => {
        const s = scopes.assistant;
        if (s.busy) K.ai.stop(s.busy);
        s.history = [];
        renderEmpty();
      });
      close.replaceWith(wrap);
      wrap.append(nb, close);
    }

    const ws = document.getElementById('home-web-search'); const ag = document.getElementById('home-agent');
    if (ws && ag) {
      ws.addEventListener('click', () => { mode = 'search'; ws.classList.add('is-active'); ag.classList.remove('is-active'); });
      ag.addEventListener('click', () => { mode = 'agent'; ag.classList.add('is-active'); ws.classList.remove('is-active'); });
    }
    fileInput = h('input', { type: 'file', accept: 'image/*' });
    fileInput.style.display = 'none';
    document.body.append(fileInput);
    const attach = document.getElementById('home-attach');
    if (attach) attach.addEventListener('click', (e) => {
      e.preventDefault();
      if (!fileInput) return;
      fileInput.dataset.target = 'home';
      fileInput.click();
    });
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      const targetScope = fileInput.dataset.target || 'home';
      const r = new FileReader();
      r.onload = (ev) => {
        attachments[targetScope] = { type: f.type, base64: ev.target.result };
        setAttachBtn(targetScope, true);
        renderPreview(targetScope);
        if (window.showKortexToast) window.showKortexToast('Imagem anexada: ' + f.name);
      };
      r.readAsDataURL(f);
      fileInput.value = '';
      fileInput.dataset.target = '';
    });
  });

  window.KortexChat = { ask };
})();
