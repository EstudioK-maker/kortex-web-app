let tabs = [], activeTabId = null, tabCounter = 0;

document.addEventListener('DOMContentLoaded', async () => {
  const config = await window.api.getConfig();
  if (config.name) {
    document.getElementById('greeting-name').innerText = config.name;
    document.getElementById('user-name').innerText = config.name;
    document.getElementById('user-avatar').innerText = config.name.charAt(0).toUpperCase();
  }
  createNewTab();
  loadRealPasswords();
  renderExtensions();
});

function createNewTab(url = '') {
  tabCounter++;
  const tabId = 'tab-' + tabCounter;
  const tabEl = document.createElement('div');
  tabEl.className = 'tab is-active';
  tabEl.id = tabId;
  tabEl.onclick = () => switchTab(tabId);
  tabEl.innerHTML = `<span class="tab__title">Novo separador</span><button class="tab__close" onclick="closeTab(event, '${tabId}')">×</button>`;
  document.getElementById('tab-strip').insertBefore(tabEl, document.getElementById('tab-strip').lastElementChild);

  const webview = document.createElement('webview');
  webview.id = 'webview-' + tabId;
  webview.src = url || 'about:blank';
  webview.style.width = '100%'; webview.style.height = '100%';
  webview.setAttribute('allowpopups', '');
  webview.setAttribute('webpreferences', 'webgl=true, backgroundThrottling=false, webSecurity=false');
  document.getElementById('webview-container').appendChild(webview);

  webview.addEventListener('did-navigate', (e) => {
    if (activeTabId === tabId) document.getElementById('url-input').value = e.url === 'about:blank' ? '' : e.url;
  });
  webview.addEventListener('page-title-updated', (e) => {
    tabEl.querySelector('.tab__title').innerText = e.title.substring(0, 20);
  });

  tabs.push({ id: tabId, webview: webview, element: tabEl });
  switchTab(tabId);
}

function switchTab(tabId) {
  activeTabId = tabId;
  tabs.forEach(t => {
    t.element.classList.toggle('is-active', t.id === tabId);
    t.webview.style.display = (t.id === tabId) ? 'flex' : 'none';
  });
  const tab = tabs.find(t => t.id === tabId);
  if (tab && tab.webview.src !== 'about:blank') {
    document.getElementById('webview-container').style.display = 'block';
    document.getElementById('home-view').style.display = 'none';
    document.getElementById('url-input').value = tab.webview.src;
  } else {
    showHome();
  }
}

function closeTab(e, tabId) {
  e.stopPropagation();
  const idx = tabs.findIndex(t => t.id === tabId);
  if (idx === -1) return;
  tabs[idx].element.remove();
  tabs[idx].webview.remove();
  tabs.splice(idx, 1);
  if (activeTabId === tabId) {
    if (tabs.length > 0) switchTab(tabs[Math.max(0, idx - 1)].id);
    else createNewTab();
  }
}

document.getElementById('url-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    let url = e.target.value.trim();
    if (!url) return;
    if (!url.startsWith('http')) url = url.includes('.') ? 'https://' + url : 'https://google.com/search?q=' + encodeURIComponent(url);
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) { tab.webview.src = url; document.getElementById('webview-container').style.display = 'block'; document.getElementById('home-view').style.display = 'none'; }
  }
});

function goBack() { const tab = tabs.find(t => t.id === activeTabId); if (tab && tab.webview.canGoBack()) tab.webview.goBack(); else showHome(); }
function goForward() { const tab = tabs.find(t => t.id === activeTabId); if (tab && tab.webview.canGoForward()) tab.webview.goForward(); }
function reloadPage() { const tab = tabs.find(t => t.id === activeTabId); if (tab) tab.webview.reload(); }

function hideAllViews() {
  document.getElementById('home-view').style.display = 'none';
  document.getElementById('webview-container').style.display = 'none';
  document.getElementById('settings-view').style.display = 'none';
  document.getElementById('plugins-view').style.display = 'none';
  document.getElementById('history-view').style.display = 'none';
  document.getElementById('extensions-view').style.display = 'none';
  document.getElementById('browser-menu').classList.remove('is-open');
}

function showHome() { hideAllViews(); document.getElementById('home-view').style.display = 'flex'; document.getElementById('url-input').value = ''; }
function showPlugins() { hideAllViews(); document.getElementById('plugins-view').style.display = 'block'; }
function showHistory() { hideAllViews(); document.getElementById('history-view').style.display = 'block'; }
function showExtensions() { hideAllViews(); document.getElementById('extensions-view').style.display = 'block'; }

function showSettings() { 
  hideAllViews(); 
  document.getElementById('settings-view').style.display = 'flex'; 
  document.getElementById('browser-menu').classList.remove('is-open');
}

function switchSettings(panelId, el) {
  document.querySelectorAll('.settings-nav-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
  else {
    const navItems = document.querySelectorAll('.settings-nav-item');
    navItems.forEach(i => { if (i.getAttribute('onclick')?.includes(panelId)) i.classList.add('active'); });
  }
  
  document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('settings-' + panelId);
  if (target) target.classList.add('active');
  
  if (panelId === 'autofill') loadRealPasswords();
}

function toggleAssistant() { document.getElementById('assistant-panel').classList.toggle('is-open'); }
function toggleBrowserMenu(e) { if (e) e.stopPropagation(); document.getElementById('browser-menu').classList.toggle('is-open'); }

document.addEventListener('click', (e) => {
  const menu = document.getElementById('browser-menu');
  if (menu.classList.contains('is-open') && !e.target.closest('#browser-menu') && !e.target.closest('#btn-profile')) {
    menu.classList.remove('is-open');
  }
});

function sendChatMessage(origin) {
  const input = document.getElementById(origin + '-chat-field');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  const container = document.getElementById(origin + '-chat-messages');
  const userMsg = document.createElement('div'); userMsg.className = 'msg user'; userMsg.innerText = text;
  container.appendChild(userMsg);
  const chatId = Date.now().toString();
  const botMsg = document.createElement('div'); botMsg.className = 'msg bot'; botMsg.id = 'bot-msg-' + chatId; botMsg.innerText = '...';
  container.appendChild(botMsg);
  container.scrollTop = container.scrollHeight;
  window.api.chat({ chatId, messages: [{ role: 'user', content: text }] });
}

window.api.onChatChunk(({ chatId, delta }) => {
  const el = document.getElementById('bot-msg-' + chatId);
  if (el) { if (el.innerText === '...') el.innerText = ''; el.innerText += delta; }
});

// AUTOFILL
let realPasswords = [];
async function loadRealPasswords() {
  try {
    realPasswords = await window.api.getRealPasswords();
    const countEl = document.getElementById('count-passwords');
    if (countEl) countEl.innerText = realPasswords.length;
    renderRealPasswords();
  } catch(e) {
    const countEl = document.getElementById('count-passwords');
    if (countEl) countEl.innerText = '0';
  }
}

function renderRealPasswords() {
  const list = document.getElementById('passwords-list');
  if (!list) return;
  list.innerHTML = '';
  if (realPasswords.length === 0) { 
    list.innerHTML = '<p style="padding:16px; color:#888;">Nenhuma palavra-passe encontrada.</p>'; 
    return; 
  }
  realPasswords.forEach((p, index) => {
    list.innerHTML += `
      <div class="autofill-item">
        <div class="autofill-item-info">
          <span class="autofill-item-title">${p.site}</span>
          <span class="autofill-item-sub">${p.user}</span>
        </div>
        <button class="autofill-delete-btn" onclick="realPasswords.splice(${index}, 1); renderRealPasswords();">×</button>
      </div>
    `;
  });
}

// EXTENSIONS
let mockExtensions = [
  { id: '1', name: 'Roblox Companion by KNIVE', version: '1.0.0', desc: 'Servidores, RAP, presença de amigos.' },
  { id: '2', name: 'Site Cloner para IA', version: '1.0.0', desc: 'Captura o HTML e CSS processado.' }
];

function renderExtensions() {
  const grid = document.getElementById('extensions-grid');
  if (!grid) return;
  grid.innerHTML = '';
  mockExtensions.forEach(ext => {
    grid.innerHTML += `<div style="background:#1a1b1d; padding:20px; border-radius:12px; border:1px solid #333;">
      <b style="color:#fff;">${ext.name}</b><br><small style="color:#888;">v${ext.version}</small>
      <p style="color:#aaa; font-size:12px; margin-top:10px;">${ext.desc}</p>
    </div>`;
  });
}

window.showToast = (msg) => {
  const t = document.getElementById('custom-toast');
  t.innerText = msg; t.style.opacity = '1'; 
  setTimeout(() => { t.style.opacity = '0'; }, 3000);
};