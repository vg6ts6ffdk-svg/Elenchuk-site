(() => {
  // Load the single corporate theme on every page. Pages share style.css;
  // theme.css is intentionally injected here so no page can fall back to the legacy dark palette.
  if (!document.querySelector('link[data-roseen-theme]')) {
    const theme = document.createElement('link');
    theme.rel = 'stylesheet';
    theme.href = 'theme.css?v=20260911';
    theme.dataset.roseenTheme = 'true';
    document.head.appendChild(theme);
  }

  const $ = (s, r = document) => [...r.querySelectorAll(s)];
  const API_BASE = (window.ROSEEN_API_BASE || '').replace(/\/$/, '');

  const assetMap = {
    'logo.svg': 'logo.svg',
    'robot-lab.png': 'robots.jpg',
    'electronics-lab.png': 'electronics.jpg',
    'appliance-lab.png': 'home-appliances.jpg',
    'robot-cta.jpg': 'robot-cta.jpg'
  };
  document.querySelectorAll('img[src^="assets/"]').forEach(img => {
    const name = img.getAttribute('src').split('/').pop();
    if (assetMap[name]) img.src = assetMap[name];
  });

  // One canonical desktop navigation on every ROSEEN page.
  // Inner pages used to keep a legacy section-based menu pointing back to index.html.
  // Normalize it at runtime so navigation stays identical across the whole site.
  const nav = document.querySelector('.site-header .nav');
  if (nav) {
    const items = [
      ['index.html', 'Главная'],
      ['services.html', 'Услуги'],
      ['robotics.html', 'Робототехника'],
      ['electronics.html', 'Электроника'],
      ['about.html', 'О компании'],
      ['contacts.html', 'Контакты']
    ];
    const current = location.pathname.split('/').pop() || 'index.html';
    nav.innerHTML = items.map(([href, label]) => {
      const active = href === current;
      return `<a href="${href}"${active ? ' aria-current="page"' : ''}>${label}</a>`;
    }).join('');
  }

  // One consistent mobile navigation on every ROSEEN page.
  // The legacy <details> menu is disabled so it cannot remain open after navigation.
  const menuWrap = document.querySelector('.menu-wrap');
  const menuButton = menuWrap?.querySelector('.menu');

  if (menuWrap && menuButton) {
    menuWrap.open = false;

    const items = [
      ['index.html', 'Главная'],
      ['services.html', 'Услуги'],
      ['robotics.html', 'Робототехника'],
      ['electronics.html', 'Электроника'],
      ['appliances.html', 'Бытовая техника'],
      ['engineering.html', 'Инженерия'],
      ['about.html', 'О компании'],
      ['contacts.html', 'Контакты'],
      ['contacts.html', 'Оставить заявку ↗']
    ];

    const overlay = document.createElement('nav');
    overlay.className = 'roseen-mobile-menu';
    overlay.setAttribute('aria-label', 'Основная навигация');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = items.map(([href, label], index) =>
      `<a href="${href}" style="--i:${index}">${label}</a>`
    ).join('');

    const style = document.createElement('style');
    style.textContent = `
      .menu-wrap .mobile-nav{display:none!important}
      @media(max-width:980px){
        .roseen-mobile-menu{position:fixed;z-index:100000;top:64px;left:0;right:0;bottom:0;display:flex;flex-direction:column;gap:0;padding:28px 24px 40px;background:rgba(255,255,255,.985);color:#111827;border-top:1px solid rgba(17,24,39,.08);overflow-y:auto;overscroll-behavior:contain;opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-12px);transition:opacity .32s var(--ease),transform .42s var(--ease),visibility 0s linear .42s}
        .roseen-mobile-menu.is-open{opacity:1;visibility:visible;pointer-events:auto;transform:none;transition-delay:0s}
        .roseen-mobile-menu a{display:block;padding:13px 0;color:#111827;font-size:27px;line-height:1.12;font-weight:800;letter-spacing:-.025em;border-bottom:1px solid rgba(17,24,39,.08);opacity:0;transform:translateY(-14px);transition:opacity .42s var(--ease),transform .42s var(--ease),color .2s}
        .roseen-mobile-menu.is-open a{opacity:1;transform:none;transition-delay:calc(var(--i) * 45ms + 80ms)}
        .roseen-mobile-menu a:hover{color:#008577}
        .roseen-mobile-menu a:last-child{margin-top:18px;padding:16px 18px;border:1px solid rgba(0,158,138,.35);border-radius:14px;background:#DDF5F0;color:#007A6D}
        body.menu-open{overflow:hidden}
      }
      @media(min-width:981px){.roseen-mobile-menu{display:none!important}}
    `;
    document.head.appendChild(style);
    document.body.appendChild(overlay);

    const setMenu = open => {
      menuWrap.open = false;
      overlay.classList.toggle('is-open', open);
      overlay.setAttribute('aria-hidden', String(!open));
      menuButton.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('menu-open', open);
    };

    menuButton.addEventListener('click', event => {
      event.preventDefault();
      setMenu(!overlay.classList.contains('is-open'));
    });

    overlay.addEventListener('click', event => {
      const link = event.target.closest('a');
      if (!link) return;
      setMenu(false);
    });

    addEventListener('pageshow', () => setMenu(false));
  }

  const revealItems = $('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    }), { threshold: .08, rootMargin: '0px 0px -30px' });
    revealItems.forEach(el => io.observe(el));
  } else {
    revealItems.forEach(el => el.classList.add('visible'));
  }

  setTimeout(() => revealItems.forEach(el => el.classList.add('visible')), 1400);

  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && matchMedia('(pointer:fine)').matches) {
    const imgs = $('.parallax-image');
    let ticking = false;
    const move = () => {
      ticking = false;
      imgs.forEach(img => {
        const r = img.closest('.media-wrap')?.getBoundingClientRect();
        if (!r) return;
        const delta = (window.innerHeight / 2 - (r.top + r.height / 2)) * 0.035;
        img.style.transform = `scale(1.04) translateY(${delta}px)`;
      });
    };
    addEventListener('scroll', () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(move);
      }
    }, { passive: true });
    move();
  }

  const form = document.querySelector('#request-form, #repairForm');
  if (form) {
    const submit = form.querySelector('button[type="submit"]');
    const status = form.querySelector('.form-status');

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (submit) submit.disabled = true;
      if (status) {
        status.textContent = 'Отправляем заявку…';
        status.classList.add('show');
      }

      try {
        const fd = new FormData(form);
        const equipmentType = fd.get('equipment_type') || fd.get('category') || fd.get('type') || '';
        const problem = fd.get('problem') || fd.get('symptom') || fd.get('description') || '';
        const model = fd.get('model') || '';
        const contact = fd.get('contact') || '';

        fd.set('equipment_type', equipmentType);
        fd.set('model', model);
        fd.set('problem', problem);
        fd.set('contact', contact);

        const response = await fetch(`${API_BASE}/api/requests`, { method: 'POST', body: fd });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Не удалось отправить заявку');
        if (status) status.textContent = `Заявка №${data.id} принята. Мы получили данные и файлы.`;
        form.reset();
      } catch (err) {
        if (status) status.textContent = err.message || 'Ошибка отправки';
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  }

  $$('.magnetic').forEach(btn => {
    if (!matchMedia('(pointer:fine)').matches) return;
    btn.addEventListener('pointermove', e => {
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * .08;
      const y = (e.clientY - r.top - r.height / 2) * .08;
      btn.style.transform = `translate(${x}px,${y}px)`;
    });
    btn.addEventListener('pointerleave', () => btn.style.transform = '');
  });
})();
