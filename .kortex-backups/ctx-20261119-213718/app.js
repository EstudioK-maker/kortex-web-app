// src/renderer/js/app.js — estrutura da janela: separadores, barra de endereço, barra lateral, página inicial.
// Regra de segurança: texto vindo da web (títulos, URLs, sugestões) entra sempre por textContent, nunca por innerHTML.

/* ============================== Notificações ============================== */
window.showKortexToast = function showKortexToast(message) {
  let container = document.querySelector('.kortex-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'kortex-toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'kortex-toast';
  toast.insertAdjacentHTML('afterbegin', '<svg width="20" height="20" viewBox="0 0 24 24" stroke="#ff5722" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>');
  const text = document.createElement('span');
  text.textContent = String(message);
  toast.append(text);
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('is-leaving'); setTimeout(() => toast.remove(), 300); }, 3500);
};
window.alert = (msg) => window.showKortexToast(msg);

document.addEventListener('DOMContentLoaded', () => {
  const K = window.kortex;
  if (!K) return;
  const $ = (s) => document.querySelector(s);

  // Impede o envio nativo dos formulários de chat (quem trata do envio é o chat.js / answer.js).
  document.querySelectorAll('form.chat-input').forEach((f) => f.addEventListener('submit', (e) => e.preventDefault()));

  /* ============================== Perfil ============================== */
  function applyProfile(config) {
    if (!config || !config.name) return;
    const greet = $('#greeting-name');
    const cardName = $('.user-card__name');
    const avatar = $('.avatar');
    if (greet) greet.textContent = config.name;
    if (cardName) cardName.textContent = config.name;
    if (avatar) {
      if (config.avatar) { avatar.style.backgroundImage = `url("${config.avatar}")`; avatar.textContent = ''; }
      else { avatar.style.backgroundImage = 'none'; avatar.textContent = config.name.charAt(0).toUpperCase(); }
    }
  }
  K.getConfig().then(applyProfile);
  K.onProfileUpdated(applyProfile);


  // Verifica se é o navegador predefinido e mostra o aviso
  if (K.app && K.app.isDefaultBrowser) {
    K.app.isDefaultBrowser().then(isDefault => {
      if (!isDefault) {
        const banner = $('#default-browser-banner');
        if (banner) {
          banner.hidden = false;
          $('#btn-set-default').addEventListener('click', async () => {
            await K.app.setDefaultBrowser();
            banner.hidden = true;
            window.showKortexToast('Escolhe o Kortex nas Definições do Windows que acabaram de abrir!');
          });
          $('#btn-close-banner').addEventListener('click', () => {
            banner.hidden = true;
          });
        }
      }
    });
  }

  /* ============================== Janela ============================== */
  $('#win-minimize')?.addEventListener('click', () => K.window.minimize());
  $('#win-maximize')?.addEventListener('click', () => K.window.maximize());
  $('#win-close')?.addEventListener('click', () => K.window.close());

  /* ============================== Separadores ============================== */
  const tabStrip = $('#tab-strip');
  const urlInput = $('#url-input');
  const urlBar = $('#url-bar');
  const BRAND_ICON = '<svg class="tab__brand" viewBox="0 0 32 32"><path d="M9 6v20M9 16l12-10M12.5 14l9.5 12"/></svg>';
  const PRIVATE_ICON = '<svg class="tab__brand" viewBox="0 0 24 24"><path d="M5 11a7 7 0 0 1 14 0v9l-3-2-2 2-2-2-2 2-2-2-3 2v-9z"/><circle cx="9.5" cy="11" r=".8"/><circle cx="14.5" cy="11" r=".8"/></svg>';
  const CLOSE_ICON = '<svg viewBox="0 0 12 12"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7"/></svg>';
  let lastActiveId = null;
  let currentTabs = [];
  let dragId = null;
  let pendingList = null; // atualização recebida a meio de um arrasto: aplica-se no fim, senão o DOM refeito cancelava o arrasto

  function tabIcon(t) {
    if (t.loading) { const s = document.createElement('span'); s.className = 'tab__spinner'; return s; }
    if (t.favicon) {
      const img = document.createElement('img');
      img.className = 'tab__favicon';
      img.alt = '';
      img.src = t.favicon;
      img.addEventListener('error', () => img.replaceWith(brandNode(t)));
      return img;
    }
    return brandNode(t);
  }
  function brandNode(t) {
    const holder = document.createElement('span');
    holder.innerHTML = t.isPrivate ? PRIVATE_ICON : BRAND_ICON;
    return holder.firstChild;
  }

  function renderTab(t, activeId) {
    const el = document.createElement('div');
    el.className = 'tab' + (t.id === activeId ? ' is-active' : '') + (t.pinned ? ' is-pinned' : '');

    const title = document.createElement('span');
    title.className = 'tab__title';
    const clean = String(t.title || '').trim();
    title.textContent = (!clean || clean === 'K') ? 'Novo separador' : clean;
    title.title = clean;

    const close = document.createElement('button');
    close.className = 'tab__close';
    close.type = 'button';
    close.innerHTML = CLOSE_ICON;
    close.addEventListener('click', (e) => { e.stopPropagation(); K.tabs.close(t.id); });

    el.append(tabIcon(t), title);
    if (t.audible || t.muted) {
      const audio = document.createElement('span');
      audio.className = 'tab__audio';
      audio.textContent = t.muted ? 'ðŸ”‡' : 'ðŸ”Š';
      el.append(audio);
    }
    el.append(close);

    // Arrastar para reordenar: a posição final é decidida pelo processo principal (K.tabs.reorder).
    el.draggable = true;
    el.addEventListener('dragstart', (e) => { dragId = t.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.id); el.classList.add('is-dragging'); });
    el.addEventListener('dragend', () => {
      dragId = null;
      tabStrip.querySelectorAll('.is-dragging, .drop-before, .drop-after').forEach((n) => n.classList.remove('is-dragging', 'drop-before', 'drop-after'));
      if (pendingList) { const d = pendingList; pendingList = null; handleTabs(d); }
    });
    el.addEventListener('dragover', (e) => {
      if (!dragId || dragId === t.id) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const before = e.clientX < r.left + r.width / 2;
      el.classList.toggle('drop-before', before);
      el.classList.toggle('drop-after', !before);
    });
    el.addEventListener('dragleave', () => el.classList.remove('drop-before', 'drop-after'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!dragId || dragId === t.id) return;
      const r = el.getBoundingClientRect();
      const before = e.clientX < r.left + r.width / 2;
      const order = currentTabs.map((x) => x.id).filter((id) => id !== dragId);
      const at = order.indexOf(t.id) + (before ? 0 : 1);
      order.splice(at, 0, dragId);
      K.tabs.reorder(order);
    });

    el.addEventListener('click', () => K.tabs.activate(t.id));
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); K.tabs.context(t.id); });
    el.addEventListener('auxclick', (e) => { if (e.button === 1) { e.preventDefault(); K.tabs.close(t.id); } });
    return el;
  }

  const badge = $('#url-badge');
  function updateSecurityBadge(active) {
    const url = (active && active.url) || '';
    const insecure = /^http:\/\//i.test(url);
    const bad = !!(active && active.certError);
    urlBar.classList.toggle('is-insecure', insecure || bad);
    if (badge) {
      badge.hidden = !(insecure || bad);
      badge.textContent = bad ? 'Certificado inválido' : 'Não seguro';
    }
  }

  function handleTabs({ tabs, activeId }) {
    if (!tabStrip) return;
    if (dragId) { pendingList = { tabs, activeId }; return; }
    currentTabs = tabs;
    tabStrip.replaceChildren(...tabs.map((t) => renderTab(t, activeId)));

    const add = document.createElement('button');
    add.className = 'icon-btn icon-btn--sm';
    add.type = 'button';
    add.title = 'Novo separador (Ctrl+T)';
    add.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
    add.addEventListener('click', () => K.tabs.create());
    tabStrip.append(add);

    const tabChanged = activeId !== lastActiveId; if (tabChanged) { lastActiveId = activeId; hideSuggestions(); }
    const active = tabs.find((t) => t.id === activeId);
    updateSecurityBadge(active);
    if (urlInput) {
      urlInput.dataset.current = active && active.url && active.url !== 'about:blank' ? active.url : '';
      if (tabChanged || document.activeElement !== urlInput) urlInput.value = urlInput.dataset.current;
    }
  }
  K.tabs.onListUpdated(handleTabs);

  /* ============================== Página inicial e recentes ============================== */
  const SITE_NAMES = { 'roblox.com': 'Roblox', 'youtube.com': 'YouTube', 'wikipedia.org': 'Wikipédia', 'github.com': 'GitHub' };

  function recentLabel(item) {
    try {
      const u = new URL(item.url);
      if (/(^|\.)(google\.com|duckduckgo\.com)$/.test(u.hostname) && u.searchParams.get('q')) return 'Pesquisa: ' + u.searchParams.get('q');
      const host = u.hostname.replace(/^www\./, '');
      return SITE_NAMES[host] || host;
    } catch (e) {
      return (item.title || item.url || '').slice(0, 25);
    }
  }

  async function renderRecents() {
    const list = $('#recent-list');
    if (!list) return;
    let history = [];
    try { history = (await K.history.get()) || []; } catch (e) { console.error('Erro ao carregar recentes:', e); }
    list.replaceChildren();
    if (!history.length) {
      const p = document.createElement('p');
      p.className = 'recent-empty';
      p.textContent = 'Sem histórico recente';
      list.append(p);
      return;
    }
    history.slice(0, 8).forEach((item) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'recent-item';
      b.title = item.url;
      const s = document.createElement('span');
      s.textContent = recentLabel(item);
      b.append(s);
      b.addEventListener('click', () => K.tabs.navigate('current', item.url));
      list.append(b);
    });
  }

  K.tabs.onShowHome((show) => {
  console.log('[onShowHome]', show);
    console.log("[KORTEX-DEBUG] onShowHome disparado, show=", show);
    const home = $('#home-view');
    const recents = $('#sidebar-recents');
    if (home) home.hidden = !show;
    
    if (show) renderRecents();

    if (show) setTimeout(() => { urlInput.focus(); urlInput.select(); }, 0);
  });
  K.history.onUpdated?.(renderRecents);
  renderRecents();

  /* ============================== Barra de endereço ============================== */
  // Cada sugestão é { text, label?, tabId? }: texto para pesquisar/abrir, ou "mudar para este separador".
  const TAB_PREFIX = '@sep';
  const omni = { open: false, items: [], selected: -1, typed: '', request: 0, timer: 0 };

  function hideSuggestions() {
    omni.request++; // invalida pedidos em curso: uma resposta tardia não volta a abrir a lista
    clearTimeout(omni.timer);
    if (!omni.open) return;
    omni.open = false;
    omni.items = [];
    omni.selected = -1;
    K.omnibox.hideSuggestions();
  }

  function drawSuggestions() {
    const r = urlBar.getBoundingClientRect();
    K.omnibox.showSuggestions({ items: omni.items, selected: omni.selected, rect: { x: r.x, y: r.y, width: r.width, height: r.height } });
  }

  function matchTabs(query, limit) {
    const q = query.toLowerCase();
    return currentTabs
      .filter((t) => t.id !== lastActiveId && (!q || (t.title || '').toLowerCase().includes(q) || (t.url || '').toLowerCase().includes(q)))
      .slice(0, limit)
      .map((t) => ({ text: t.url || '', label: 'Mudar para: ' + ((t.title || '').trim() || t.url || 'Novo separador'), tabId: t.id }));
  }

  async function updateSuggestions() {
    const raw = urlInput.value;
    const text = raw.trim();
    if (!text) { hideSuggestions(); return; }
    const request = ++omni.request;

    let items;
    if (text.toLowerCase().startsWith(TAB_PREFIX)) {
      // Modo "procurar separadores" (Ctrl+Shift+K): só separadores abertos, filtrados pelo texto a seguir ao prefixo.
      items = matchTabs(text.slice(TAB_PREFIX.length).trim(), 8);
      if (!items.length) { hideSuggestions(); return; }
    } else {
      let remote = [];
      try { remote = (await K.getSuggestions(text)) || []; } catch (e) { remote = []; }
      if (request !== omni.request || document.activeElement !== urlInput) return;
      const tabs = text.length >= 2 ? matchTabs(text, 3) : [];
      const web = remote.filter((s) => s.toLowerCase() !== text.toLowerCase());
      if (!tabs.length && !web.length) { hideSuggestions(); return; }
      items = [{ text }, ...tabs, ...web.map((w) => ({ text: w }))].slice(0, 8);
    }
    if (request !== omni.request) return;
    omni.typed = raw;
    omni.items = items;
    omni.selected = -1;
    omni.open = true;
    drawSuggestions();
  }

  function pick(item) {
    hideSuggestions();
    if (item.tabId) K.tabs.activate(item.tabId); else K.omnibox.go(item.text);
    urlInput.blur();
  }

  function moveSelection(step) {
    const n = omni.items.length;
    omni.selected = omni.selected + step;
    if (omni.selected >= n) omni.selected = -1;
    if (omni.selected < -1) omni.selected = n - 1;
    const item = omni.items[omni.selected];
    urlInput.value = !item || item.tabId ? omni.typed : item.text; // separadores não substituem o texto escrito
    drawSuggestions();
  }

  const restoreUrl = () => { urlInput.value = urlInput.dataset.current || ''; };

  if (urlInput && urlBar) {
    urlInput.addEventListener('input', () => {
      clearTimeout(omni.timer);
      omni.timer = setTimeout(updateSuggestions, 150);
    });
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const tabMode = urlInput.value.trim().toLowerCase().startsWith(TAB_PREFIX);
        const item = omni.selected >= 0 ? omni.items[omni.selected] : (tabMode && omni.items[0]) || { text: urlInput.value };
        pick(item);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (omni.open) moveSelection(e.key === 'ArrowDown' ? 1 : -1);
        else if (urlInput.value.trim()) updateSuggestions();
      } else if (e.key === 'Escape') {
        if (omni.open) { urlInput.value = omni.typed; hideSuggestions(); }
        else { restoreUrl(); urlInput.blur(); }
      }
    });
    let justFocused = false;
    urlInput.addEventListener('focus', () => { urlInput.select(); justFocused = true; });
    urlInput.addEventListener('mouseup', (e) => { if (justFocused) { e.preventDefault(); justFocused = false; } });
    // O blur também dispara quando a janela perde o foco (clique na página); o atraso deixa o clique numa sugestão passar.
    urlInput.addEventListener('blur', () => setTimeout(() => {
      if (document.hasFocus() && document.activeElement === urlInput) return;
      hideSuggestions();
      if (urlInput.value.trim().toLowerCase().startsWith(TAB_PREFIX)) restoreUrl();
    }, 150));
    window.addEventListener('resize', hideSuggestions);
    K.omnibox.onPicked?.(() => { hideSuggestions(); urlInput.blur(); });
    K.on('tabsearch:open', () => { urlInput.focus(); urlInput.value = TAB_PREFIX + ' '; updateSuggestions(); });
  }

  /* ============================== Botões e navegação ============================== */
  $('#btn-back')?.addEventListener('click', () => K.tabs.back());
  $('#btn-forward')?.addEventListener('click', () => K.tabs.forward());
  $('#btn-reload')?.addEventListener('click', () => K.tabs.reload());
  // Abre/fecha o popup de extensões ancorado ao botão (a lista vive numa vista própria, por cima das páginas).
  $('#btn-extensions')?.addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    K.extMenu.toggle({ x: r.x, y: r.y, width: r.width, height: r.height });
  });
  $('#btn-private')?.addEventListener('click', () => K.tabs.createPrivate());
  $('#btn-profile')?.addEventListener('click', (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    K.menu.open('main', rect.right - 10, rect.bottom + 4);
  });
  $('#btn-assistant')?.addEventListener('click', () => $('#assistant-panel')?.classList.toggle('is-open'));
  $('#assistant-close')?.addEventListener('click', () => $('#assistant-panel')?.classList.remove('is-open'));

  // A barra lateral guarda o estado na definição; o appearance.js é quem aplica a classe (uma só fonte de verdade).
  $('#btn-toggle-sidebar')?.addEventListener('click', async () => {
    const collapsed = !!(await window.kortexSettings.get('appearance.sidebarCollapsed'));
    window.kortexSettings.set('appearance.sidebarCollapsed', !collapsed);
  });

  // Itens com data-go="<endereço>" navegam o separador atual (barra lateral, cartão do utilizador).
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-go]');
    if (target) K.tabs.navigate('current', target.dataset.go);
  });

  /* ============================== Limites da página ============================== */
  // O separador é uma vista nativa por cima desta área; o processo principal precisa dos seus limites exatos.
  const pageHost = $('#page-host');
  if (pageHost) {
    const sendBounds = () => {
      const r = pageHost.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) K.layout.setPageBounds({ x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) });
    };
    new ResizeObserver(sendBounds).observe(pageHost);
    window.addEventListener('resize', sendBounds);
    window.addEventListener('load', sendBounds);
    sendBounds();
  }
});

