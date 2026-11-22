import { SETTINGS_SCHEMA } from './settings-schema.js';

let currentSection = 'you';
let currentSubPage = null;

document.addEventListener('DOMContentLoaded', async () => {
  const nav = document.getElementById('settings-nav');
  const content = document.getElementById('settings-column');
  
  // 1. Renderizar a navegacao
  SETTINGS_SCHEMA.forEach(sec => {
    const a = document.createElement('a');
    a.className = `settings-nav__item ${sec.id === 'you' ? 'is-active' : ''}`;
    a.href = `#${sec.id}`;
    a.dataset.section = sec.id;
    a.innerHTML = `<svg class="icon"><use href="#${sec.icon}"/></svg><span>${sec.title}</span>`;
    
    if (sec.id === 'extensions') {
      a.innerHTML += `<svg class="icon icon-external"><use href="#i-external"/></svg>`;
      a.setAttribute('data-external', 'true');
      a.href = 'kortex://extensions';
    }
    
    nav.appendChild(a);
  });

  // 2. Renderizar as secoes
  SETTINGS_SCHEMA.forEach(sec => {
    const section = document.createElement('section');
    section.className = `s-section ${sec.id === 'you' ? '' : 'is-hidden'}`;
    section.id = `section-${sec.id}`;
    
    let html = `<h2 class="s-section-title">${sec.title}</h2>`;
    
    sec.groups.forEach(group => {
      html += `<div class="s-card">`;
      if (group.title) html += `<div class="s-group-title">${group.title}</div>`;
      
      group.rows.forEach(row => {
        html += renderRow(row);
      });
      html += `</div>`;
    });
    
    section.innerHTML = html;
    content.appendChild(section);
  });

  // 3. Ligar os eventos
  setupNavigation();
  setupSearch();
  setupControls();
  await loadSettings();
});

function renderRow(row) {
  if (row.type === 'toggle') {
    return `<div class="s-row"><div class="s-row__main"><div class="s-row__label">${row.label}</div>${row.desc ? `<div class="s-row__desc">${row.desc}</div>` : ''}</div>
      <label class="s-toggle"><input type="checkbox" data-key="${row.key}" role="switch"><span class="s-toggle__track"></span></label></div>`;
  }
  if (row.type === 'select') {
    const opts = row.options.map(o => `<option value="${o.val}">${o.text}</option>`).join('');
    return `<div class="s-row"><div class="s-row__main"><div class="s-row__label">${row.label}</div></div>
      <select class="s-select" data-key="${row.key}">${opts}</select></div>`;
  }
  if (row.type === 'swatches') {
    const swatches = row.options.map(c => `<button class="s-swatch ${c === row.default ? 'is-selected' : ''}" style="background:${c}" data-color="${c}"></button>`).join('');
    return `<div class="s-row"><div class="s-row__main"><div class="s-row__label">${row.label}</div></div>
      <div class="s-swatches" data-key="${row.key}">${swatches}</div></div>`;
  }
  if (row.type === 'link') {
    return `<a class="s-row s-row--link" href="#${row.to}"><span class="s-row__main"><span class="s-row__label">${row.label}</span></span><svg class="icon s-row__chevron"><use href="#i-chevron-r"/></svg></a>`;
  }
  if (row.type === 'button') {
    return `<div class="s-row"><div class="s-row__main"><div class="s-row__label">${row.label}</div></div><button class="s-btn s-btn--primary" data-action="${row.action}">${row.btnLabel}</button></div>`;
  }
  if (row.type === 'danger') {
    return `<div class="s-row s-row--danger"><div class="s-row__main"><div class="s-row__label">${row.label}</div></div><button class="s-btn s-btn--danger" data-action="${row.action}">${row.btnLabel}</button></div>`;
  }
  if (row.type === 'readonly') {
    return `<div class="s-row"><div class="s-row__main"><div class="s-row__label">${row.label}</div></div><span class="s-row__value">${row.value}</span></div>`;
  }
  return '';
}

function setupNavigation() {
  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();
}

function handleHashChange() {
  const hash = window.location.hash.replace('#', '') || 'you';
  const [section, subpage] = hash.split('/');
  
  document.querySelectorAll('.settings-nav__item').forEach(el => {
    el.classList.toggle('is-active', el.dataset.section === section);
  });
  
  document.querySelectorAll('.s-section').forEach(el => {
    el.classList.toggle('is-hidden', el.id !== `section-${section}`);
  });
}

function setupSearch() {
  const search = document.getElementById('settings-search');
  search.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    // Implementacao simples de pesquisa no futuro
    if (!term) return;
  });
}

async function loadSettings() {
  const settings = await window.kortexSettings.getAll();
  
  document.querySelectorAll('[data-key]').forEach(el => {
    const key = el.getAttribute('data-key');
    const val = settings[key];
    if (val !== undefined) {
      if (el.type === 'checkbox') el.checked = val;
      else el.value = val;
    }
  });
}

function setupControls() {
  document.addEventListener('change', async (e) => {
    if (e.target.hasAttribute('data-key')) {
      const key = e.target.getAttribute('data-key');
      const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      await window.kortexSettings.set(key, val);
    }
  });
}