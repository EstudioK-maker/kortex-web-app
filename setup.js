let selectedTheme = 'dark';
let selectedBrowsers = [];

document.addEventListener('DOMContentLoaded', () => {
  window.api.detectBrowsers().then(browsers => {
    const list = document.getElementById('detected-browsers');
    if (browsers.length === 0) { list.innerHTML = '<p style="color: #555; font-size: 13px;">Nenhum dado encontrado.</p>'; return; }
    list.innerHTML = '';
    browsers.forEach(b => {
      selectedBrowsers.push(b);
      const label = document.createElement('label');
      label.style = 'display: flex; align-items: center; gap: 10px; font-size: 14px; color: #fff; cursor: pointer; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px;';
      label.innerHTML = `<input type="checkbox" checked value="${b}" onchange="toggleBrowser('${b}', this.checked)"> ${b}`;
      list.appendChild(label);
    });
  });
});

function toggleBrowser(name, isChecked) {
  if (isChecked) { if (!selectedBrowsers.includes(name)) selectedBrowsers.push(name); }
  else { selectedBrowsers = selectedBrowsers.filter(b => b !== name); }
}

function nextStep(step) {
  document.querySelectorAll('.setup-step').forEach(s => s.classList.remove('active'));
  document.getElementById('step-' + step).classList.add('active');
}

function selectTheme(theme, el) {
  selectedTheme = theme;
  document.querySelectorAll('.theme-option').forEach(opt => opt.classList.remove('active'));
  el.classList.add('active');
}

async function finishSetup() {
  const name = document.getElementById('browser-name').value || 'Knive';
  const btn = document.querySelector('#step-4 .btn-primary');
  
  if (selectedBrowsers.length > 0) {
    btn.innerText = 'Importando dados...';
    btn.disabled = true;
    await window.api.importBrowserData(selectedBrowsers);
  }
  window.api.saveSetup({ name, theme: selectedTheme, model: 'anthropic/claude-3.5-sonnet:online' });
}