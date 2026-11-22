window.showKortexToast = function(message) {
    let container = document.querySelector('.kortex-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'kortex-toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'kortex-toast';
    toast.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff5722" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg><span>` + message + `</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'toast-out 0.3s ease forwards'; setTimeout(() => toast.remove(), 300); }, 3500);
};
window.alert = function(msg) { window.showKortexToast(msg); };

const SETTINGS_SCHEMA = [
  { id: 'you', title: 'Eu e o Kortex', icon: 'i-user', groups: [ { rows: [ { type: 'link', label: 'Perfil do utilizador', to: 'you/profile' } ] } ] },
  { id: 'autofill', title: 'Preenchimento automático', icon: 'i-key', groups: [ { rows: [ { type: 'custom-autofill', label: 'Palavras-passe guardadas' } ] } ] },
  { id: 'assistant', title: 'Assistente IA', icon: 'i-k', groups: [ { rows: [
          { type: 'toggle', key: 'assistant.enabled', label: 'Ativar o assistente', desc: 'Mostra o painel do assistente e permite pedidos à IA. Desligado, nada é enviado.' },
          { type: 'toggle', key: 'assistant.pageAccess', label: 'Permitir ler a página aberta', desc: 'O texto da página é enviado à IA quando uma skill precisa dele. Nunca em separadores privados.' },
          { type: 'toggle', key: 'ai.webSearch', label: 'Pesquisa na web (mais lento)', desc: 'Liga a pesquisa online em cada resposta. Deixa desligado para respostas rápidas.' },
          { type: 'input', key: 'ai.apiKey', label: 'Chave da API (OpenRouter)', desc: 'Obtém em openrouter.ai/keys. Fica guardada só neste computador.', password: true, placeholder: 'sk-or-v1-...' },
          { type: 'input', key: 'ai.model', label: 'Modelo', desc: 'ID do modelo no OpenRouter (openrouter.ai/models).', placeholder: 'google/gemini-2.0-flash-001' },
          { type: 'link', label: 'Skills e plugins', to: 'assistant/plugins' }
      ]} ] },
  { id: 'privacy', title: 'Privacidade e segurança', icon: 'i-shield', groups: [
      { title: 'Como o Kortex te protege', rows: [
          { type: 'icon-link', icon: 'i-shield', label: 'Bloqueio', desc: 'Bloquear rastreadores e anúncios conhecidos', to: 'privacy/blocking' },
          { type: 'toggle', key: 'privacy.gpc', label: 'Controlo Global de Privacidade', desc: 'Diz aos sites que não queres que vendam ou partilhem os teus dados (Sec-GPC).' }
      ]},
      { title: 'Outras definições', rows: [
          { type: 'icon-link', icon: 'i-trash', label: 'Eliminar dados de navegação', desc: 'Elimine o histórico, os cookies, a cache e muito mais', to: 'privacy/clear' },
          { type: 'icon-link', icon: 'i-cookie', label: 'Cookies de terceiros', desc: 'Bloqueio, exceções e "Não monitorizar"', to: 'privacy/cookies' },
          { type: 'button', action: 'openPermissions', label: 'Permissões dos sites', btnLabel: 'Gerir' },
          { type: 'toggle', key: 'privacy.clearOnExit', label: 'Eliminar cookies e cache ao sair', desc: 'Terminas a sessão em todos os sites sempre que fechas o Kortex.' },
          { type: 'toggle', key: 'privacy.suggestions', label: 'Sugestões de pesquisa', desc: 'Enviar o que escreves na barra ao motor de pesquisa para obter sugestões' }
      ]}
  ]},
  { id: 'appearance', title: 'Aspeto', icon: 'i-palette', groups: [
  { title: 'Tema', rows: [
    { type: 'select', key: 'appearance.theme', label: 'Tema', options: [ { val: 'dark', text: 'Escuro' }, { val: 'light', text: 'Claro' }, { val: 'system', text: 'Igual ao sistema' } ] },
    { type: 'swatches', key: 'appearance.accent', label: 'Cor de destaque', options: ['#ff5722', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b', '#ec4899', '#06b6d4'] },
    { type: 'select', key: 'appearance.font', label: 'Fonte da interface', options: [ { val: 'segoe', text: 'Segoe UI' }, { val: 'inter', text: 'Inter' }, { val: 'system', text: 'Sistema' }, { val: 'mono', text: 'Monoespaçada' } ] },
    { type: 'toggle', key: 'appearance.forceDark', label: 'Forçar modo escuro nos sites', desc: 'Experimental. Inverte as cores de sites claros; pode ficar estranho em sites que já são escuros.' }
  ]},
  { title: 'Interface', rows: [
    { type: 'toggle', key: 'appearance.compact', label: 'Interface compacta', desc: 'Separadores e barra de ferramentas mais baixos.' },
    { type: 'toggle', key: 'appearance.bookmarksBar', label: 'Mostrar barra de marcadores', desc: 'Atalho: Ctrl+Shift+B.' },
    { type: 'toggle', key: 'appearance.showAssistantBtn', label: 'Mostrar botão do Assistente' },
    { type: 'toggle', key: 'appearance.sidebarCollapsed', label: 'Barra lateral recolhida', desc: 'Só mostra os ícones.' },
    { type: 'toggle', key: 'appearance.reduceMotion', label: 'Reduzir animações' }
  ]},
  { title: 'Página inicial', rows: [
    { type: 'toggle', key: 'appearance.showGreeting', label: 'Mostrar saudação' },
    { type: 'select', key: 'appearance.homeBackground', label: 'Fundo', options: [ { val: 'plain', text: 'Liso' }, { val: 'glow', text: 'Brilho suave' } ] }
  ]},
  { title: 'Assistente', rows: [
    { type: 'select', key: 'appearance.chatFontSize', label: 'Tamanho do texto das respostas', options: [ { val: '13', text: 'Pequeno' }, { val: '14', text: 'Médio' }, { val: '16', text: 'Grande' } ] }
  ]},
  { title: 'Páginas', rows: [
    { type: 'select', key: 'appearance.zoom', label: 'Zoom predefinido', options: [ { val: '0.8', text: '80%' }, { val: '0.9', text: '90%' }, { val: '1', text: '100%' }, { val: '1.1', text: '110%' }, { val: '1.25', text: '125%' }, { val: '1.5', text: '150%' } ] }
  ]}
]},
  { id: 'search', title: 'Motor de pesquisa', icon: 'i-search', groups: [ { rows: [ { type: 'select', key: 'search.engine', label: 'Motor predefinido na barra de endereços', options: [ { val: 'google', text: 'Google' }, { val: 'duckduckgo', text: 'DuckDuckGo' }, { val: 'bing', text: 'Bing' }, { val: 'brave', text: 'Brave Search' }, { val: 'ecosia', text: 'Ecosia' }, { val: 'perplexity', text: 'Perplexity' } ] } ] } ] },
  { id: 'startup', title: 'Ao iniciar', icon: 'i-wrench', groups: [ { rows: [
          { type: 'select', key: 'startup.mode', label: 'Quando o Kortex abre', options: [ { val: 'newtab', text: 'Abrir um novo separador' }, { val: 'continue', text: 'Continuar onde fiquei' } ] },
          { type: 'toggle', key: 'startup.openAtLogin', label: 'Abrir o Kortex ao iniciar o Windows', desc: 'Só funciona na versão instalada, não em "npm run dev".' }
      ]} ] },
  { id: 'downloads', title: 'Transferências', icon: 'i-download', groups: [ { rows: [
          { type: 'toggle', key: 'downloads.askEach', label: 'Perguntar onde guardar cada ficheiro' },
          { type: 'toggle', key: 'downloads.showWhenDone', label: 'Mostrar na pasta quando terminar', desc: 'Abre o Explorador no ficheiro. Nunca o executa automaticamente.' },
          { type: 'readonly', key: 'downloads.folder', label: 'Pasta de destino', empty: 'Transferências (predefinida)' },
          { type: 'button', action: 'chooseDownloadFolder', label: 'Alterar pasta', btnLabel: 'Escolher…' }
      ]} ] },
  { id: 'system', title: 'Sistema', icon: 'i-wrench', groups: [ { rows: [
          { type: 'button', action: 'setDefaultBrowser', label: 'Navegador predefinido', btnLabel: 'Definir como Padrão' },
          { type: 'button', action: 'openDataFolder', label: 'Abrir pasta de dados', btnLabel: 'Abrir' },
          { type: 'button', action: 'resetAll', label: 'Repor todas as definições', btnLabel: 'Repor', danger: true }
      ]} ] },
  { id: 'about', title: 'Acerca do Kortex', icon: 'i-k', groups: [ { rows: [ { type: 'readonly', key: 'about.version', label: 'Versão' } ] } ] }
];

document.addEventListener('DOMContentLoaded', async () => {
  const nav = document.getElementById('settings-nav');
  const content = document.getElementById('settings-column');

  SETTINGS_SCHEMA.forEach(sec => {
    const a = document.createElement('a');
    a.className = `settings-nav__item ${sec.id === 'you' ? 'is-active' : ''}`;
    a.href = `#${sec.id}`;
    a.dataset.section = sec.id;
    a.innerHTML = `<svg class="icon"><use href="#${sec.icon}"/></svg><span>${sec.title}</span>`;
    nav.appendChild(a);
  });

  SETTINGS_SCHEMA.forEach(sec => {
    const section = document.createElement('section');
    section.className = `s-section ${sec.id === 'you' ? '' : 'is-hidden'}`;
    section.id = `section-${sec.id}`;
    let html = `<h2 class="s-section-title">${sec.title}</h2>`;
    sec.groups.forEach(group => {
      html += `<div class="s-card">`;
      if (group.title) html += `<div class="s-card__title">${group.title}</div>`;
      group.rows.forEach(row => { html += renderRow(row); });
      html += `</div>`;
    });
    section.innerHTML = html;
    content.appendChild(section);
  });

  setupNavigation();
  setupControls();
  await loadSettings();
});

const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function renderRow(row) {
  if (row.type === 'toggle') return `<div class="s-row"><div class="s-row__main"><div class="s-row__label">${escHtml(row.label)}</div>${row.desc ? `<div class="s-row__desc">${escHtml(row.desc)}</div>` : ''}</div><label class="s-toggle"><input type="checkbox" data-key="${row.key}" role="switch"><span class="s-toggle__track"></span></label></div>`;
  if (row.type === 'select') { const opts = row.options.map(o => `<option value="${o.val}">${escHtml(o.text)}</option>`).join(''); return `<div class="s-row"><div class="s-row__main"><div class="s-row__label">${escHtml(row.label)}</div></div><select class="s-select" data-key="${row.key}">${opts}</select></div>`; }
  if (row.type === 'link') return `<a class="s-row s-row--link" href="javascript:void(0)" data-route="${row.to}"><span class="s-row__main"><span class="s-row__label">${escHtml(row.label)}</span></span><svg class="icon s-row__chevron"><use href="#i-chevron-r"/></svg></a>`;
  if (row.type === 'icon-link') return `<a class="s-row s-row--link" href="javascript:void(0)" data-route="${row.to}"><svg class="icon s-row__icon"><use href="#${row.icon}"/></svg><div class="s-row__main"><div class="s-row__label">${escHtml(row.label)}</div>${row.desc ? `<div class="s-row__desc">${escHtml(row.desc)}</div>` : ''}</div><svg class="icon s-row__chevron"><use href="#i-chevron-r"/></svg></a>`;
  if (row.type === 'button') return `<div class="s-row"><div class="s-row__main"><div class="s-row__label">${escHtml(row.label)}</div></div><button class="s-btn ${row.danger ? 's-btn--danger' : ''}" data-action="${row.action}">${escHtml(row.btnLabel)}</button></div>`;
  if (row.type === 'readonly') return `<div class="s-row"><div class="s-row__main"><div class="s-row__label">${escHtml(row.label)}</div></div><span class="s-row__value" ${row.key ? `data-key="${row.key}"` : ''} data-empty="${escHtml(row.empty || '—')}">${escHtml(row.value ?? '')}</span></div>`;
  if (row.type === 'input') return `<div class="s-row"><div class="s-row__main"><div class="s-row__label">${escHtml(row.label)}</div>${row.desc ? `<div class="s-row__desc">${escHtml(row.desc)}</div>` : ''}</div><input class="s-input" data-key="${row.key}" type="${row.password ? 'password' : 'text'}" placeholder="${escHtml(row.placeholder || '')}" autocomplete="off" spellcheck="false"></div>`;
  if (row.type === 'swatches') return `<div class="s-row"><div class="s-row__main"><div class="s-row__label">${escHtml(row.label)}</div></div><div class="s-swatches" data-key="${row.key}">${row.options.map(c => `<button type="button" class="s-swatch" style="background:${c}" data-color="${c}" title="${c}"></button>`).join('')}</div></div>`;
  if (row.type === 'custom-autofill') return `<div class="s-row" id="autofill-list-container" style="flex-direction: column; align-items: stretch; padding: 20px;"><p style="color: #888; font-size: 13px;">A carregar passwords...</p></div>`;
  return '';
}

function setupNavigation() {
  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();
}

async function handleHashChange() {
  const hash = window.location.hash.replace('#', '') || 'you';
  const [section, subpage] = hash.split('/');
  const settingsColumn = document.getElementById('settings-column');
  const extraColumn = document.getElementById('profile-column');
  
  if (section === 'you' && subpage === 'profile') {
      settingsColumn.style.display = 'none'; extraColumn.style.display = 'block'; renderProfile(); return;
  }
  settingsColumn.style.display = 'block'; extraColumn.style.display = 'none';
  document.querySelectorAll('.settings-nav__item').forEach(el => { el.classList.remove('is-active'); if (el.dataset.section === section) el.classList.add('is-active'); });
  document.querySelectorAll('.s-section').forEach(el => { el.classList.toggle('is-hidden', el.id !== `section-${section}`); });

  if (section === 'autofill') {
      const container = document.getElementById('autofill-list-container');
      if (container) {
          try {
              const saved = await window.kortex.autofill.list() || {};
              if (Object.keys(saved).length === 0) {
                  container.innerHTML = `<p style="color: #888; font-size: 13px;">Nenhuma palavra-passe guardada.</p>`;
              } else {
                  let html = '';
                  for (const domain in saved) {
                      html += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--border-color);">
                                  <div>
                                      <div style="font-size: 14px; font-weight: 500;">${escHtml(domain)}</div>
                                      <div style="font-size: 13px; color: #888;">${escHtml(saved[domain].username)}</div>
                                  </div>
                                  <button class="s-btn s-btn--danger" onclick="window.deletePassword(${escHtml(JSON.stringify(domain))})">Remover</button>
                               </div>`;
                  }
                  container.innerHTML = html;
              }
          } catch (e) {
              container.innerHTML = `<p style="color: red;">Erro ao carregar passwords.</p>`;
          }
      }
  }
}

document.addEventListener('click', (e) => {
    const link = e.target.closest('.s-row--link');
    if (link && link.dataset.route) {
        e.preventDefault();
        const route = link.dataset.route;
        if (route === 'privacy/blocking') openBlockingPage();
        else if (route === 'privacy/clear') openClearDataPage();
        else if (route === 'privacy/cookies') openThirdPartyCookiesPage();
        else if (route === 'you/profile') window.location.hash = '#you/profile';
    }
});

function closeSubPage() {
    document.getElementById('settings-column').style.display = 'block';
    document.getElementById('profile-column').style.display = 'none';
}

function openBlockingPage() {
    const settingsColumn = document.getElementById('settings-column');
    const extraColumn = document.getElementById('profile-column');
    settingsColumn.style.display = 'none'; extraColumn.style.display = 'block';
    extraColumn.innerHTML = `<div class="s-section" style="padding-top: 32px;"><button class="s-btn" id="btn-back-blocking" style="display: inline-flex; align-items: center; gap: 8px; margin-bottom: 24px; background: transparent; border: none; color: #fff; cursor: pointer; padding: 0;"><svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2;"><path d="M19 12H5M12 19l-7-7 7-7"/></svg><span style="font-weight: 600; font-size: 16px;">Bloqueio</span></button><h3 style="font-size: 14px; font-weight: 600; margin-bottom: 16px;">Anúncios</h3><div class="s-card" style="padding: 20px;"><div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;"><div style="flex: 1;"><div style="font-size: 14px; font-weight: 500; margin-bottom: 6px;">Bloquear rastreadores e anúncios conhecidos</div><div style="font-size: 13px; color: var(--text-muted); line-height: 1.5;">O Kortex utiliza listas de filtros de código aberto para bloquear a maioria dos anúncios e rastreadores conhecidos entre sites. Alguns rastreadores não podem ser bloqueados ao nível do navegador.</div></div><label class="s-toggle" style="margin-top: 2px;"><input type="checkbox" id="toggle-adblock"><span class="s-toggle__track"></span></label></div></div></div>`;
    document.getElementById('btn-back-blocking').addEventListener('click', closeSubPage);
    if (window.kortexSettings) {
        window.kortexSettings.get('privacy.blockAds').then(val => {
            const toggle = document.getElementById('toggle-adblock');
            if (toggle) { toggle.checked = (val !== false); toggle.addEventListener('change', (e) => { window.kortexSettings.set('privacy.blockAds', e.target.checked); }); }
        });
    }
}

async function openClearDataPage() {
    const settingsColumn = document.getElementById('settings-column');
    const extraColumn = document.getElementById('profile-column');
    settingsColumn.style.display = 'none'; extraColumn.style.display = 'block';
    extraColumn.innerHTML = `<div class="s-section" style="padding-top: 32px;"><button class="s-btn" id="btn-back-clear" style="display: inline-flex; align-items: center; gap: 8px; margin-bottom: 24px; background: transparent; border: none; color: #fff; cursor: pointer; padding: 0;"><svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2;"><path d="M19 12H5M12 19l-7-7 7-7"/></svg><span style="font-weight: 600; font-size: 16px;">Eliminar dados de navegação</span></button><div class="time-pills" id="time-selector"><button class="time-pill" data-time="15m">Últimos 15 min</button><button class="time-pill active" data-time="1h">Última hora</button><button class="time-pill" data-time="24h">Últimas 24 horas</button><button class="time-pill" data-time="all">Tudo</button></div><div class="s-card" style="padding: 0; margin-bottom: 20px;"><div class="s-row" style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; gap: 16px;"><input type="checkbox" id="chk-history" checked style="width: 18px; height: 18px; accent-color: #00d2ff;"><div><div style="font-weight: 500; font-size: 14px;">Histórico de navegação</div><div style="font-size: 13px; color: var(--text-muted);" id="desc-history">0 itens</div></div></div><div class="s-row" style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; gap: 16px;"><input type="checkbox" id="chk-cookies" checked style="width: 18px; height: 18px; accent-color: #00d2ff;"><div><div style="font-weight: 500; font-size: 14px;">Cookies e outros dados de sites</div><div style="font-size: 13px; color: var(--text-muted);" id="desc-cookies">A calcular...</div></div></div><div class="s-row" style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; gap: 16px;"><input type="checkbox" id="chk-cache" checked style="width: 18px; height: 18px; accent-color: #00d2ff;"><div><div style="font-weight: 500; font-size: 14px;">Imagens e ficheiros em cache</div><div style="font-size: 13px; color: var(--text-muted);" id="desc-cache">A calcular...</div></div></div><div id="extra-clear-options" style="display: none;"><div class="s-row" style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; gap: 16px; align-items: center;"><input type="checkbox" id="chk-autofill" checked style="width: 18px; height: 18px; accent-color: #00d2ff;"><div><div style="font-weight: 500; font-size: 14px;">Preenchimento automático</div><div style="font-size: 13px; color: var(--text-muted);">Passwords guardadas</div></div></div></div><button class="show-more-btn" id="btn-show-more">Mostrar mais</button></div><div style="display: flex; justify-content: flex-end; gap: 12px;"><button class="s-btn" id="btn-cancel-clear" style="background: transparent; border: 1px solid var(--border-color);">Cancelar</button><button class="s-btn" id="btn-execute-clear" style="background: #00d2ff; color: #000; font-weight: bold;">Eliminar deste dispositivo</button></div></div>`;
    
    document.getElementById('btn-back-clear').addEventListener('click', closeSubPage);
    document.getElementById('btn-cancel-clear').addEventListener('click', closeSubPage);

    if (window.kortex && window.kortex.clearData) {
        const stats = await window.kortex.clearData.getStats();
        document.getElementById('desc-history').innerText = stats.historyCount + " itens";
        document.getElementById('desc-cookies').innerText = "De " + stats.cookiesCount + " sites";
        document.getElementById('desc-cache').innerText = "Menos de " + stats.cacheSize;
    }

    let selectedTime = '1h';
    document.querySelectorAll('#time-selector .time-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#time-selector .time-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active'); selectedTime = btn.getAttribute('data-time');
        });
    });

    document.getElementById('btn-show-more').addEventListener('click', function() {
        const extra = document.getElementById('extra-clear-options');
        if (extra.style.display === 'none') { extra.style.display = 'block'; this.innerText = 'Mostrar menos'; }
        else { extra.style.display = 'none'; this.innerText = 'Mostrar mais'; }
    });

    document.getElementById('btn-execute-clear').addEventListener('click', async () => {
        const options = {
            history: document.getElementById('chk-history').checked,
            cookies: document.getElementById('chk-cookies').checked,
            cache: document.getElementById('chk-cache').checked,
            autofill: document.getElementById('chk-autofill').checked,
            timeRange: selectedTime
        };
        if (window.kortex && window.kortex.clearData) {
            await window.kortex.clearData.execute(options);
            window.showKortexToast('Dados eliminados com sucesso!');
            closeSubPage();
        }
    });
}

async function openThirdPartyCookiesPage() {
    const settingsColumn = document.getElementById('settings-column');
    const extraColumn = document.getElementById('profile-column');
    settingsColumn.style.display = 'none'; extraColumn.style.display = 'block';
    
    const blockCookies = await window.kortexSettings.get('privacy.blockThirdPartyCookies') !== false;
    const dntEnabled = await window.kortexSettings.get('privacy.dnt') === true;
    const exceptions = await window.kortexSettings.get('privacy.cookieExceptions') || [];

    extraColumn.innerHTML = `
        <div class="s-section" style="padding-top: 32px; max-width: 700px;">
            <button class="s-btn" id="btn-back-cookies" style="display: inline-flex; align-items: center; gap: 8px; margin-bottom: 24px; background: transparent; border: none; color: #fff; cursor: pointer; padding: 0;">
                <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2;"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                <span style="font-weight: 600; font-size: 18px;">Cookies de terceiros</span>
            </button>

            <p style="color: var(--text-muted); font-size: 14px; line-height: 1.6; margin-bottom: 30px;">
                Um site que visita pode incorporar conteúdo de outros sites, por exemplo, imagens, anúncios e texto. Os cookies definidos por estes sites são denominados cookies de terceiros.
            </p>

            <div class="s-card" style="padding: 0; margin-bottom: 24px;">
                <div class="s-row" style="padding: 16px 20px; display: flex; align-items: center; gap: 16px; border-bottom: 1px solid var(--border-color); cursor: pointer;" id="radio-permit">
                    <input type="radio" name="thirdPartyCookies" value="permit" ${!blockCookies ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--accent-color); cursor: pointer;">
                    <span style="font-size: 14px; font-weight: 500;">Permitir cookies de terceiros</span>
                </div>
                <div class="s-row" style="padding: 16px 20px; display: flex; align-items: center; gap: 16px; cursor: pointer;" id="radio-block">
                    <input type="radio" name="thirdPartyCookies" value="block" ${blockCookies ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--accent-color); cursor: pointer;">
                    <span style="font-size: 14px; font-weight: 500;">Bloquear cookies de terceiros</span>
                </div>
            </div>

            <div id="cookie-info-box" style="display: ${blockCookies ? 'block' : 'none'}; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px;">
                    <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: none; stroke: var(--text-muted); stroke-width: 2; flex-shrink: 0; margin-top: 2px;"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/></svg>
                    <span style="font-size: 14px; color: var(--text-muted);">Sites can't store third-party cookies in your browser</span>
                </div>
                <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; padding-left: 12px;">
                    <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: none; stroke: var(--text-muted); stroke-width: 2; flex-shrink: 0; margin-top: 2px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    <span style="font-size: 13px; color: var(--text-muted); line-height: 1.5;">This limits cross-site tracking that relies on cookies. It does not stop tracking pixels, fingerprinting, or server-side tracking. Adblock blocks many known pixels and trackers, but no browser setting can block server-side tracking.</span>
                </div>
                <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px;">
                    <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: none; stroke: var(--text-muted); stroke-width: 2; flex-shrink: 0; margin-top: 2px;"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    <span style="font-size: 14px; color: var(--text-muted);">Sites can still use cookies to see your activity on their own site</span>
                </div>
                <div style="display: flex; align-items: flex-start; gap: 12px;">
                    <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: none; stroke: var(--text-muted); stroke-width: 2; flex-shrink: 0; margin-top: 2px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                    <span style="font-size: 14px; color: var(--text-muted);">Some site features that rely on third-party cookies may not work</span>
                </div>
            </div>

            <h3 style="font-size: 14px; font-weight: 500; color: var(--text-muted); margin-bottom: 12px;">Avançadas</h3>
            <div class="s-card" style="padding: 16px 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-size: 14px; font-weight: 500;">Enviar um pedido "Não monitorizar" com o seu tráfego de navegação</div>
                    <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Os sites usam a respetiva descrição ao responder a este pedido</div>
                </div>
                <label class="s-toggle">
                    <input type="checkbox" id="toggle-dnt" ${dntEnabled ? 'checked' : ''}>
                    <span class="s-toggle__track"></span>
                </label>
            </div>

            <div class="s-card" style="padding: 16px 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                <span style="font-size: 14px; font-weight: 500;">Ver todos os dados de sites e autorizações</span>
                <svg class="icon s-row__chevron"><use href="#i-chevron-r"/></svg>
            </div>

            <div style="font-size: 14px; font-weight: 500; margin-bottom: 8px;">Sites com autorização para usar cookies de terceiros</div>
            <div style="font-size: 13px; color: var(--text-muted); line-height: 1.6; margin-bottom: 16px;">
                Afeta os sites listados aqui. A inserção de "<b>[*.]</b>" antes de um nome de domínio cria uma exceção para todo o domínio.
            </div>

            <div class="s-card" style="padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div id="exceptions-list" style="font-size: 14px; color: var(--text-muted);">
                    ${exceptions.length === 0 ? 'Nenhum site adicionado' : exceptions.join(', ')}
                </div>
                <button class="s-btn" id="btn-add-exception">Adicionar</button>
            </div>
        </div>
    `;

    document.getElementById('btn-back-cookies').onclick = closeSubPage;

    document.querySelectorAll('input[name="thirdPartyCookies"]').forEach(radio => {
        radio.addEventListener('change', async (e) => {
            const isBlock = e.target.value === 'block';
            await window.kortexSettings.set('privacy.blockThirdPartyCookies', isBlock);
            document.getElementById('cookie-info-box').style.display = isBlock ? 'block' : 'none';
            window.showKortexToast(isBlock ? 'Cookies de terceiros bloqueados' : 'Cookies de terceiros permitidos');
        });
    });

    document.getElementById('toggle-dnt').addEventListener('change', async (e) => {
        await window.kortexSettings.set('privacy.dnt', e.target.checked);
        window.showKortexToast(e.target.checked ? 'Pedido "Não monitorizar" ligado' : 'Pedido "Não monitorizar" desligado');
    });

    document.getElementById('btn-add-exception').addEventListener('click', async () => {
        const domain = prompt("Introduz o domínio (ex: exemplo.pt ou [*.]exemplo.pt):");
        if (domain && domain.trim()) {
            let currentExceptions = await window.kortexSettings.get('privacy.cookieExceptions') || [];
            if (!currentExceptions.includes(domain.trim())) {
                currentExceptions.push(domain.trim());
                await window.kortexSettings.set('privacy.cookieExceptions', currentExceptions);
                document.getElementById('exceptions-list').innerText = currentExceptions.join(', ');
                window.showKortexToast('Site adicionado às exceções!');
            }
        }
    });
}

async function renderProfile() {
    const content = document.getElementById('profile-column');
    content.innerHTML = '<p style="color: var(--text-muted); padding-top: 32px;">A carregar perfil...</p>';
    try {
        const config = await window.kortex.getConfig() || {};
        content.innerHTML = `<div class="s-section" style="padding-top: 32px;"><button class="s-btn" id="btn-back-profile" style="margin-bottom: 24px;">← Voltar</button><div class="s-card" style="padding: 24px;"><div style="display: flex; gap: 24px; align-items: center; margin-bottom: 30px;"><div style="position: relative; cursor: pointer;" id="avatar-container"><div id="profile-avatar-preview" style="width: 80px; height: 80px; border-radius: 50%; background: #38393d; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: bold; overflow: hidden; border: 2px solid var(--border-color); background-size: cover; background-position: center;">${config.avatar ? '' : (config.name || 'K').charAt(0).toUpperCase()}</div><div style="position: absolute; bottom: 0; right: 0; background: var(--accent-color); width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px;">+</div><input type="file" id="profile-avatar-input" accept="image/*" style="display: none;"></div><div><h3 style="margin-bottom: 5px; font-size: 18px; color: #fff;">Foto de Perfil</h3><p style="color: var(--text-muted); font-size: 13px;">Clica na imagem para alterar.</p></div></div><div style="margin-bottom: 20px;"><label style="display: block; margin-bottom: 8px; font-size: 14px; color: var(--text-muted);">Nome</label><input type="text" id="profile-name" value="${config.name || ''}" style="width: 100%; padding: 12px; background: var(--bg-color); border: 1px solid var(--border-strong); color: #fff; border-radius: 8px; outline: none;"></div><div style="margin-bottom: 30px;"><label style="display: block; margin-bottom: 8px; font-size: 14px; color: var(--text-muted);">Apelido (Username)</label><input type="text" id="profile-username" value="${config.username || ''}" placeholder="@utilizador" style="width: 100%; padding: 12px; background: var(--bg-color); border: 1px solid var(--border-strong); color: #fff; border-radius: 8px; outline: none;"></div><button class="s-btn s-btn--primary" id="btn-save-profile" style="height: 40px; padding: 0 24px;">Guardar Alterações</button></div></div>`;
        if (config.avatar) document.getElementById('profile-avatar-preview').style.backgroundImage = `url('${config.avatar}')`;
        document.getElementById('btn-back-profile').onclick = () => { window.location.hash = '#you'; };
        let newAvatar = config.avatar || null;
        document.getElementById('avatar-container').onclick = () => document.getElementById('profile-avatar-input').click();
        document.getElementById('profile-avatar-input').onchange = (e) => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => { newAvatar = ev.target.result; const preview = document.getElementById('profile-avatar-preview'); preview.style.backgroundImage = `url('${newAvatar}')`; preview.innerText = ''; };
            reader.readAsDataURL(file);
        };
        document.getElementById('btn-save-profile').onclick = async () => {
            const newName = document.getElementById('profile-name').value.trim();
            const newUsername = document.getElementById('profile-username').value.trim();
            if (!newName) return window.showKortexToast('O nome não pode estar vazio.');
            await window.kortex.updateProfile({ name: newName, username: newUsername, avatar: newAvatar });
            window.showKortexToast('Perfil atualizado com sucesso!');
            window.location.hash = '#you';
        };
    } catch (err) { content.innerHTML = `<p style="color: #ff6b62; padding-top: 32px;">Erro: ${err.message}</p>`; }
}

window.deletePassword = async (domain) => {
  if (confirm(`Apagar password de ${domain}?`)) {
    await window.kortex.autofill.delete(domain);
    handleHashChange();
  }
};

async function applyValueToEl(el, val) {
  if (el.type === 'checkbox') el.checked = !!val;
  else if (el.tagName === 'SELECT') el.value = String(val);
  else if (el.tagName === 'INPUT') el.value = val == null ? '' : String(val);
  else if (el.classList && el.classList.contains('s-swatches')) {
    el.querySelectorAll('.s-swatch').forEach(b => b.classList.toggle('is-selected', b.dataset.color === val));
    if (el.dataset.key === 'appearance.accent' && val) document.documentElement.style.setProperty('--accent-color', val);
  }
  else if (el.classList.contains('s-row__value')) el.textContent = (val === '' || val == null) ? (el.dataset.empty || '—') : String(val);
}
async function loadSettings() {
  if (!window.kortexSettings) return;
  const all = await window.kortexSettings.getAll();
  document.querySelectorAll('[data-key]').forEach(el => {
    const key = el.getAttribute('data-key');
    if (key in all) applyValueToEl(el, all[key]);
  });
}
function setupControls() {
  document.addEventListener('click', async (e) => {
    const sw = e.target.closest('.s-swatch');
    if (!sw) return;
    await window.kortexSettings.set(sw.parentElement.dataset.key, sw.dataset.color);
  });
  document.addEventListener('change', async (e) => {
    const key = e.target.getAttribute && e.target.getAttribute('data-key');
    if (!key || !window.kortexSettings) return;
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    const r = await window.kortexSettings.set(key, val);
    if (r && r.success === false) { window.showKortexToast('Não foi possível guardar: ' + r.error); await loadSettings(); return; }
    if (r && r.reloadTabs) window.showKortexToast('Recarrega os separadores abertos para aplicar.');
    if (r && r.restart) window.showKortexToast('Reinicia o Kortex para aplicar.');
  });
  const ACTIONS = {
    setDefaultBrowser: async () => { if (window.kortex.app && window.kortex.app.setDefaultBrowser) { await window.kortex.app.setDefaultBrowser(); window.showKortexToast('Kortex definido como predefinido!'); } },
    openDataFolder: () => window.kortexSettings.set('system.openDataFolder', null),
    openPermissions: () => window.kortex.tabs.openInternal('kortex://permissions'),
    chooseDownloadFolder: () => window.kortexSettings.set('downloads.chooseFolder', null),
    resetAll: async () => {
      if (!confirm('Repor todas as definições para os valores predefinidos?')) return;
      await window.kortexSettings.reset();
      await loadSettings();
      window.showKortexToast('Definições repostas.');
    },
  };
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn && ACTIONS[btn.dataset.action]) ACTIONS[btn.dataset.action]();
  });
  window.kortexSettings?.onChanged?.(({ key, value }) => {
    document.querySelectorAll(`[data-key="${key}"]`).forEach(el => applyValueToEl(el, value));
  });
}
