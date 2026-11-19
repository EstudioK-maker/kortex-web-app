document.getElementById('year').textContent = new Date().getFullYear();
const toast = document.getElementById('toast');
let toastTimer = null;
document.querySelectorAll('[data-download]').forEach(btn => {
  btn.addEventListener('click', () => {
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2800);
  });
});