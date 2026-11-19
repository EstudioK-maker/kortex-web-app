document.addEventListener('DOMContentLoaded', async () => {
  const devMode = document.getElementById('dev-mode');
  const devToolbar = document.getElementById('dev-toolbar');
  const grid = document.getElementById('ext-grid');

  devMode.addEventListener('change', () => {
    devToolbar.style.display = devMode.checked ? 'flex' : 'none';
    renderExtensions();
  });

  document.getElementById('btn-load').addEventListener('click', async () => {
    const res = await window.kortex.extensions.loadUnpacked();
    if (res.success) {
      alert('Extensão carregada com sucesso!');
      renderExtensions();
    } else if (res.error) {
      alert('Erro ao carregar: ' + res.error);
    }
  });

  async function renderExtensions() {
    grid.innerHTML = '';
    const exts = await window.kortex.extensions.list();
    
    if (exts.length === 0) {
      grid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1 / -1;">Nenhuma extensão instalada.</p>';
      return;
    }

    exts.forEach(ext => {
      const card = document.createElement('div');
      card.className = 'ext-card';
      card.innerHTML = `
        <div class="ext-card-header">
          <div class="ext-card-title">${ext.name}</div>
          <div class="ext-card-version">v${ext.version}</div>
        </div>
        <div class="ext-card-desc">
          ID: ${ext.id}<br>
          Caminho: ${ext.path}
        </div>
        <div class="ext-card-actions">
          ${devMode.checked ? `<button class="btn-remove" onclick="removeExtension('${ext.id}')">Remover</button>` : ''}
          <label class="toggle"><input type="checkbox" checked><span class="slider"></span></label>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  window.removeExtension = async (id) => {
    if (confirm('Tem a certeza que quer remover esta extensão?')) {
      const res = await window.kortex.extensions.remove(id);
      if (res.success) renderExtensions();
      else alert('Erro ao remover: ' + res.error);
    }
  };

  renderExtensions();
});