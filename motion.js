/* Progressive motion: no logo transforms, no hidden-by-default content. */
(() => {
  if (!window.matchMedia || !Element.prototype.animate) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set();
  let observer;
  const mobile = matchMedia('(max-width: 800px)').matches;
  const rise = [{ opacity: 0, transform: `translateY(${mobile ? 10 : 14}px)` }, { opacity: 1, transform: 'none' }];
  const duration = mobile ? 250 : 320;
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
    const key = 'roseen.motion.v6.seen';
    first = sessionStorage.getItem(key) !== '1';
    sessionStorage.setItem(key, '1');
  } catch { /* Restricted storage: use a static brand instead of looping. */ }
  document.documentElement.dataset.motionEntry = first && !reduced.matches ? 'first' : 'static';
  if (first && !reduced.matches) {
    play(document.querySelector('.brand img'), [{ opacity: 0 }, { opacity: 1 }], { duration: 600 });
    document.querySelectorAll('.brand-token').forEach((el, i) => {
      play(el, rise, { duration, delay: i * 180 });
      play(el.querySelector('b'), [{ color: '#93B8FF' }, { color: '#3B82F6' }], { duration, delay: i * 180 });
    });
    // A short opening composition, then the page remains still. Animate only
    // elements already on screen; lower content keeps its scroll reveal.
    const entry = [
      ['.hero-copy h1', 90],
      ['.hero-copy .lead', 180],
      ['.hero-copy .actions', 270],
      ['.hero-copy .trust', 360],
    ];
    entry.forEach(([selector, delay]) => {
      const el = document.querySelector(selector);
      if (el && el.getBoundingClientRect().top < innerHeight) play(el, rise, { duration, delay });
    });
    document.querySelectorAll('.hero-art .hero-image, .hero-art .hero-card').forEach((el, i) => {
      if (el.getBoundingClientRect().top < innerHeight) play(el, [{ opacity: 0 }, { opacity: 1 }], { duration, delay: 140 + i * 180 });
    });
  }
  if (!reduced.matches && 'IntersectionObserver' in window) {
    try {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          play(entry.target, rise, { duration });
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
