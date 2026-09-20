/* Progressive motion: no logo transforms, no hidden-by-default content. */
(() => {
  if (!window.matchMedia || !Element.prototype.animate) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set();
  let observer;
  const stop = () => { animations.forEach(a => a.cancel()); animations.clear(); observer?.disconnect(); };
  function play(el, keyframes, options) {
    if (!el || reduced.matches || el.contains(document.activeElement)) return;
    try {
      const a = el.animate(keyframes, { ...options, easing: 'cubic-bezier(.2,.75,.2,1)', fill: 'backwards' });
      animations.add(a);
      a.addEventListener('finish', () => animations.delete(a), { once: true });
      a.addEventListener('cancel', () => animations.delete(a), { once: true });
    } catch { /* Static is a complete, accessible fallback. */ }
  }
  let first = false;
  try {
    const key = 'roseen.motion.v5.seen';
    first = sessionStorage.getItem(key) !== '1';
    sessionStorage.setItem(key, '1');
  } catch { /* Restricted storage: use a static brand instead of looping. */ }
  document.documentElement.dataset.motionEntry = first && !reduced.matches ? 'first' : 'static';
  if (first && !reduced.matches) {
    play(document.querySelector('.brand img'), [{ opacity: 0 }, { opacity: 1 }], { duration: 600 });
    document.querySelectorAll('.brand-token').forEach((el, i) => play(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 360, delay: i * 180 }));
  }
  if (!reduced.matches && 'IntersectionObserver' in window) {
    try {
      const mobile = matchMedia('(max-width: 800px)').matches;
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          play(entry.target, [{ opacity: 0, transform: `translateY(${mobile ? 10 : 14}px)` }, { opacity: 1, transform: 'none' }], { duration: mobile ? 250 : 320 });
        });
      }, { threshold: 0.03 });
      document.querySelectorAll('.reveal').forEach(el => {
        if (el.getBoundingClientRect().top >= innerHeight && !el.querySelector('.brand')) observer.observe(el);
      });
    } catch { observer?.disconnect(); }
  }
  document.addEventListener('focusin', e => {
    animations.forEach(a => { if (a.effect?.target?.contains(e.target)) a.cancel(); });
  });
  reduced.addEventListener('change', e => { if (e.matches) stop(); });
  addEventListener('pageshow', e => { if (e.persisted) stop(); });
})();
