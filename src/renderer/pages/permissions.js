// kortex://permissions — lista e revoga as permissões guardadas por site.
(function () {
  const K = window.kortex;
  const list = document.getElementById('list');
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  async function render() {
    const all = (await K.permissions.list()) || [];
    list.replaceChildren();
    if (!all.length) { list.append(h('div', 'empty', 'Ainda não guardaste nenhuma permissão.')); return; }

    const bySite = {};
    all.forEach((p) => { (bySite[p.origin] = bySite[p.origin] || []).push(p); });
    Object.keys(bySite).sort().forEach((origin) => {
      list.append(h('div', 'site', origin));
      bySite[origin].forEach((p) => {
        const row = h('div', 'row');
        row.append(h('span', 'label', p.label.charAt(0).toUpperCase() + p.label.slice(1)));
        row.append(h('span', 'state ' + (p.allowed ? 'allow' : 'block'), p.allowed ? 'Permitido' : 'Bloqueado'));
        const rm = h('button', '', 'Remover');
        rm.addEventListener('click', async () => { await K.permissions.remove(p.key); render(); });
        row.append(rm);
        list.append(row);
      });
    });
  }

  document.getElementById('clear').addEventListener('click', async () => {
    if (confirm('Remover todas as permissões guardadas?')) { await K.permissions.clear(); render(); }
  });
  render();
})();
