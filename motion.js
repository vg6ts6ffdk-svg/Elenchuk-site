/* Progressive motion: no logo transforms, no hidden-by-default content. */
(() => {
  if (!window.matchMedia || !Element.prototype.animate) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set();
  let observer;
  const mobile = matchMedia('(max-width: 1100px), (pointer: coarse)').matches;
  const rise = [{ opacity: 0, transform: `translateY(${mobile ? 12 : 16}px)` }, { opacity: 1, transform: 'none' }];
  const duration = mobile ? 320 : 350;
  const fade = [{ opacity: 0 }, { opacity: 1 }];
  const seen = new WeakSet();
  const pending = new Set();
  let changes;
  const stop = () => { animations.forEach(a => a.cancel()); animations.clear(); observer?.disconnect(); changes?.disconnect(); pending.clear(); };
  function play(el, keyframes, options) {
    if (!el || reduced.matches || el.contains(document.activeElement)) return;
    try {
      // Phones get a single opacity effect, without delayed translations or
      // overlapping child animations while the user is swiping.
      const a = el.animate(mobile ? fade : keyframes, { ...options, ...(mobile ? { duration: el.matches('.brand img') ? 600 : 220, delay: 0 } : {}), easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
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
      if (!mobile) play(el.querySelector('b'), [{ color: '#93B8FF' }, { color: '#3B82F6' }], { duration, delay: i * 180 });
    });
    // A short opening composition, then the page remains still. Animate only
    // elements already on screen; lower content keeps its scroll reveal.
    const entry = [
      ['.hero-copy h1', 100],
      ['.hero-copy .lead', 200],
      ['.hero-copy .actions', 300],
      ['.hero-copy .trust', 400],
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
    'main .media-wrap', 'main .inner-image', 'main .feature-copy',
    'main .news-feature', 'main .number',
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
    el.dataset.motionVisible = 'true';
    if (mobile) {
      play(el, fade, { duration: 220 });
      return;
    }
    // Editorial blocks have a reading order, rather than moving every paragraph
    // in a large panel at once. The panel itself and all its content stay visible
    // by default; each effect is additive and can be cancelled immediately.
    if (el.matches('.section-head, .feature-copy, .final-panel')) {
      [...el.children].filter(child => !child.matches('.feature-list')).forEach((child, i) => {
        play(child, child.matches('.eyebrow') ? fade : rise, { duration, delay: delay + Math.min(i, 3) * 70 });
      });
      el.querySelectorAll('.feature-item').forEach((child, i) => {
        seen.add(child);
        play(child, rise, { duration, delay: delay + 140 + i * 70 });
      });
    } else if (el.matches('.direction-card')) {
      play(el, fade, { duration, delay });
      play(el.querySelector('.direction-card-content'), rise, { duration, delay: delay + 70 });
    } else {
      play(el, el.matches('img, .media-wrap') || el.querySelector('img') ? fade : rise, { duration, delay });
    }
  }
  // Stagger only siblings in the same visible row. On a narrow phone every
  // single-column card starts immediately when it enters the viewport.
  function rowDelay(el) {
    const parent = el.parentElement;
    if (!parent?.matches('.service-grid, .direction-grid, .steps, .fault-grid, .store-categories, .product-grid, .numbers-grid')) return 0;
    const top = el.getBoundingClientRect().top;
    const row = [...parent.children].filter(child => Math.abs(child.getBoundingClientRect().top - top) < 24);
    return Math.max(0, row.indexOf(el)) * 70;
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
        else reveal(el, opening ? Math.max(rowDelay(el), (visible++ % 3) * 70) : rowDelay(el));
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
          entries.forEach(entry => {
            if (entry.isIntersecting) reveal(entry.target, rowDelay(entry.target));
          });
        }, { threshold: 0.03, rootMargin: mobile ? '0px 0px 120px 0px' : '0px 0px -24px 0px' });
      } catch { /* Content is visible even without an observer. */ }
    }
    if (first) enter(true);
    register(true);
    first = false;
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
  if (document.readyState !== 'loading') start();
  else addEventListener('DOMContentLoaded', start, { once: true });
  document.querySelectorAll('details.faq').forEach(details => {
    details.addEventListener('toggle', () => {
      if (!details.open) return;
      [...details.children].filter(el => el.tagName !== 'SUMMARY').forEach(el => play(el, fade, { duration: 180 }));
    });
  });
  document.addEventListener('focusin', e => {
    animations.forEach(a => { if (a.effect?.target?.contains(e.target)) a.cancel(); });
  });
  if (mobile) addEventListener('touchmove', () => {
    animations.forEach(a => a.cancel()); animations.clear();
  }, { passive: true });
  const header = document.querySelector('.site-header');
  let headerFrame = false;
  function updateHeader() {
    headerFrame = false;
    header?.classList.toggle('is-scrolled', scrollY > 24);
  }
  addEventListener('scroll', () => {
    if (!headerFrame) { headerFrame = true; requestAnimationFrame(updateHeader); }
  }, { passive: true });
  updateHeader();
  reduced.addEventListener('change', e => { if (e.matches) stop(); else startContent(); });
  addEventListener('pageshow', e => {
    if (e.persisted) { stop(); first = false; startContent(); updateHeader(); }
  });
})();
