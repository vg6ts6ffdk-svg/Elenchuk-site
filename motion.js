/* Progressive motion: no logo transforms, no hidden-by-default content. */
(() => {
  if (!window.matchMedia || !Element.prototype.animate) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set();
  let observer;
  const mobile = matchMedia('(max-width: 800px)').matches;
  const rise = [{ opacity: 0, transform: `translateY(${mobile ? 10 : 14}px)` }, { opacity: 1, transform: 'none' }];
  const duration = mobile ? 250 : 320;
  const fade = [{ opacity: 0 }, { opacity: 1 }];
  const seen = new WeakSet();
  const pending = new Set();
  let changes;
  const stop = () => { animations.forEach(a => a.cancel()); animations.clear(); observer?.disconnect(); changes?.disconnect(); pending.clear(); };
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
  const hero = document.querySelector('.hero-copy .brand-sequence');
  const replay = document.querySelector('.motion-replay');
  try {
    const key = 'roseen.motion.v7.seen';
    first = !!hero && sessionStorage.getItem(key) !== '1';
    if (first) sessionStorage.setItem(key, '1');
  } catch { /* Restricted storage: use a static brand instead of looping. */ }
  document.documentElement.dataset.motionEntry = first && !reduced.matches ? 'first' : 'static';
  function enter(includeLogo = false) {
    if (reduced.matches) return;
    animations.forEach(a => a.cancel()); animations.clear();
    if (includeLogo) play(document.querySelector('.brand img'), [{ opacity: 0 }, { opacity: 1 }], { duration: 600 });
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
  if (replay) {
    const sync = () => {
      replay.hidden = false;
      replay.disabled = reduced.matches;
      replay.title = reduced.matches ? 'Анимация отключена настройками устройства' : 'Повторить появление первого экрана';
    };
    sync(); reduced.addEventListener('change', sync);
    replay.addEventListener('click', () => enter());
  }
  // One shared vocabulary for service, editorial and store pages. Avoid nested
  // reveals: an image/form/card moves as one unit, never each child separately.
  const selector = [
    'main .reveal', 'main h1', 'main .section-head', 'main .feature-item',
    'main .direction-card', 'main .service-card', 'main .fault-card', 'main .step',
    'main .faq', 'main .final-panel', 'main .briefing-card', 'main .briefing-section',
    'main .briefing-item', 'main .briefing-summary', 'main .briefing-scope',
    'main .briefing-actions', 'main .briefing-heading .eyebrow',
    'main .store-category', 'main .selection-guide', 'main .store-notice',
    'main .catalog-toolbar', 'main .store-filters', 'main .store-empty',
    'main .product-card', 'main .product-visual', 'main .product-details',
    'main .cart-summary', 'main .cart-row', 'main .account-locked',
    'main .inner-hero .eyebrow', 'main .inner-hero .lead',
    'main .inner-hero .actions', 'main .inner-hero .trust',
    'main .store-hero .lead', 'main .store-hero .eyebrow',
    'main .account-hero .lead', 'main .cart-heading .lead', 'main .briefing-heading .lead',
    'main .hero-copy h1', 'main .hero-copy .lead', 'main .hero-copy .actions',
    'main .hero-copy .trust', 'main .hero-art .hero-image', 'main .hero-art .hero-card',
  ].join(',');
  function reveal(el, delay = 0) {
    if (seen.has(el)) return;
    seen.add(el); pending.delete(el); observer?.unobserve(el);
    play(el, el.matches('img') || el.querySelector('img') ? fade : rise, { duration, delay });
  }
  function register(opening = false) {
    if (reduced.matches) return;
    const candidates = [...document.querySelectorAll(selector)].filter(el =>
      !el.querySelector('.brand, .brand-sequence, h1') &&
      !el.closest('footer, .site-header, [aria-live]'));
    const roots = new Set(candidates);
    let visible = 0;
    candidates.forEach(el => {
      for (let parent = el.parentElement; parent; parent = parent.parentElement) {
        if (roots.has(parent)) return;
      }
      if (seen.has(el) || pending.has(el)) return;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      if (rect.bottom > 0 && rect.top < innerHeight) {
        // Preserve the agreed first-session home composition and its replay.
        if (opening && first && el.closest('.hero-copy, .hero-art')) seen.add(el);
        else reveal(el, opening ? (visible++ % 3) * (mobile ? 35 : 60) : 0);
      } else if (rect.top >= innerHeight && observer) {
        pending.add(el); observer.observe(el);
      }
    });
  }
  function startContent() {
    if (reduced.matches) return;
    if ('IntersectionObserver' in window) {
      try {
        observer = new IntersectionObserver(entries => {
          let i = 0;
          entries.forEach(entry => {
            if (entry.isIntersecting) reveal(entry.target, (i++ % 3) * (mobile ? 35 : 60));
          });
        }, { threshold: 0.03 });
      } catch { /* Content is visible even without an observer. */ }
    }
    if (first) enter(true);
    register(true);
    // Catalogue results can arrive after load. Animate new cards, not input
    // values, prices, live statuses or a customer's typing.
    const main = document.querySelector('main');
    if (main && 'MutationObserver' in window) {
      changes = new MutationObserver(() => {
        pending.forEach(el => { if (!el.isConnected) { pending.delete(el); observer?.unobserve(el); } });
        register();
      });
      changes.observe(main, { childList: true, subtree: true });
    }
  }
  // Wait for a real first paint on mobile; subsequent pages get their own short
  // content entrance while the brand sequence remains session-scoped.
  const start = () => requestAnimationFrame(() => requestAnimationFrame(startContent));
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
  document.querySelectorAll('details.faq, details.menu-wrap').forEach(details => {
    details.addEventListener('toggle', () => {
      if (details.open) [...details.children].filter(el => el.tagName !== 'SUMMARY').forEach(el => play(el, fade, { duration: 180 }));
    });
  });
  document.addEventListener('focusin', e => {
    animations.forEach(a => { if (a.effect?.target?.contains(e.target)) a.cancel(); });
  });
  reduced.addEventListener('change', e => { if (e.matches) stop(); });
  addEventListener('pageshow', e => { if (e.persisted) stop(); });
})();
