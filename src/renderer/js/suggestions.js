// src/renderer/js/suggestions.js — desenha a lista enviada pelo processo principal e devolve a escolha.
// Cada item é { text, label, tabId? }: com tabId é "mudar para este separador".
(function () {
  const list = document.getElementById('list');
  const ICON_SEARCH = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>';
  const ICON_TAB = '<svg viewBox="0 0 24 24"><rect x="3.5" y="6" width="17" height="12.5" rx="2.5"/><path d="M3.5 10h17"/></svg>';

  window.kortex.omnibox.onSuggestions(({ items, selected }) => {
    list.replaceChildren();
    items.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'row' + (i === selected ? ' is-selected' : '');
      row.insertAdjacentHTML('afterbegin', item.tabId ? ICON_TAB : ICON_SEARCH);
      const label = document.createElement('span');
      label.textContent = item.label || item.text; // nunca innerHTML: o texto vem da rede / de páginas
      row.append(label);
      // mousedown (e não click): a barra de endereço perde o foco no mesmo gesto e fecharia a lista antes do click.
      row.addEventListener('mousedown', (e) => { e.preventDefault(); window.kortex.omnibox.pickSuggestion({ text: item.text, tabId: item.tabId }); });
      list.append(row);
    });
  });
})();
