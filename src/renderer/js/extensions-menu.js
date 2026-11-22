(function () {
  const K = window.kortex;
  const list = document.getElementById('list');
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  const SVG_PIN = '<svg viewBox="0 0 24 24"><path d="M12 17v5M5 17h14a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2z"/><path d="M9 11V5a3 3 0 0 1 6 0v6"/></svg>';
  const SVG_KEBAB = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>';

  function row(item) {
    const r = el('div', 'row');
    if (item.icon) { const img = el('img', 'icon'); img.src = item.icon; r.append(img); }
    else r.append(el('span', 'letter', (item.name || '?').charAt(0).toUpperCase()));
    r.append(el('span', 'name', item.name));

    const actions = el('div', 'actions');
    const pin = el('button'); pin.innerHTML = SVG_PIN; pin.title = 'Fixar';
    const kebab = el('button'); kebab.innerHTML = SVG_KEBAB; kebab.title = 'Mais opções';
    kebab.addEventListener('click', (e) => { e.stopPropagation(); K.extMenu.manage(); });
    actions.append(pin, kebab);
    r.append(actions);
    r.addEventListener('click', () => K.extMenu.open(item.id));
    return r;
  }

  function renderGroup(title, desc, items) {
    if (!items.length) return;
    const group = el('div', 'group');
    group.append(el('div', 'group-title', title));
    group.append(el('div', 'group-desc', desc));
    items.forEach(it => group.append(row(it)));
    list.append(group);
  }

  K.extMenu.onRender((data) => {
    list.replaceChildren();
    if (!data || !data.groups || !data.groups.length) {
      list.append(el('div', 'group-desc', 'Nenhuma extensão instalada.'));
    } else {
      data.groups.forEach(g => renderGroup(g.title, g.desc, g.items));
    }
  });

  document.getElementById('manage').addEventListener('click', () => K.extMenu.manage());
  document.getElementById('close').addEventListener('click', () => K.extMenu.close());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') K.extMenu.close(); });
})();
