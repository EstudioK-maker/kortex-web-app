const menuEl = document.getElementById('browser-menu');

// Mostrar o menu na posição correta
window.kortex.menu.onState((state) => {
  if (menuEl) {
    menuEl.style.top = state.y + 'px';
    menuEl.style.right = (window.innerWidth - state.x) + 'px';
    menuEl.classList.add('is-open');
    document.body.style.pointerEvents = 'auto';
  }
});

// Esconder o menu
window.kortex.menu.onClosed(() => { 
  if (menuEl) menuEl.classList.remove('is-open'); 
  document.body.style.pointerEvents = 'none'; 
});

// Clicar nos itens
document.querySelectorAll('#browser-menu [data-action]').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    window.kortex.menu.action(el.getAttribute('data-action'));
  });
});

// Fechar ao clicar fora
document.body.addEventListener('mousedown', (e) => {
  if (menuEl && menuEl.classList.contains('is-open') && !e.target.closest('#browser-menu')) {
    window.kortex.menu.close();
  }
});

// Atualizar o nome/avatar no menu
window.kortex.getConfig().then(config => {
  if (config && config.name) {
    document.getElementById('menu-name').innerText = config.name;
    document.getElementById('menu-avatar').innerText = config.name.charAt(0).toUpperCase();
  }
});