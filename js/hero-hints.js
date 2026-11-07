// Allow hover/focus explanations to be dismissed without moving the pointer.
(() => {
  const hero = document.querySelector('.hero-copy');
  if (!hero) return;
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') hero.classList.add('hero-hints-dismissed');
  });
  hero.querySelectorAll('a[aria-describedby]').forEach(link => {
    const reveal = () => {
      hero.classList.remove('hero-hints-dismissed');
      const hint = link.querySelector('.hero-hint');
      hint.style.left = '0px';
      const rect = hint.getBoundingClientRect();
      hint.style.left = `${Math.min(0, innerWidth - 18 - rect.right)}px`;
    };
    link.addEventListener('pointerenter', reveal);
    link.addEventListener('focus', reveal);
  });
})();
