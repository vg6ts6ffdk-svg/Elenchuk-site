(() => {
  const $ = (s, r = document) => [...r.querySelectorAll(s)];
  const API_BASE = (window.ROSEEN_API_BASE || '').replace(/\/$/, '');

  // Some legacy pages still reference the old /assets/ paths. Keep them working
  // while the repository is migrated to its current root-level asset set.
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

  // Main-page mobile menu: restore the complete navigation and its animation.
  // This is intentionally scoped to index.html so other pages are untouched.
  const isHomePage = location.pathname === '/' || /\/index\.html$/.test(location.pathname);
  if (isHomePage) {
    const menuWrap = document.querySelector('.menu-wrap');
    const menuButton = menuWrap?.querySelector('.menu');
    const mobileNav = menuWrap?.querySelector('.mobile-nav');

    if (menuWrap && menuButton && mobileNav) {
      const items = [
        ['index.html', 'Главная'],
        ['services.html', 'Услуги'],
        ['robotics.html', 'Робототехника'],
        ['electronics.html', 'Электроника'],
        ['appliances.html', 'Бытовая техника'],
        ['engineering.html', 'Инженерия'],
        ['about.html', 'О компании'],
        ['contacts.html', 'Контакты'],
        ['index.html#request', 'Оставить заявку ↗']
      ];

      mobileNav.innerHTML = items.map(([href, label]) => `<a href="${href}">${label}</a>`).join('');
      menuButton.setAttribute('aria-expanded', 'false');
      mobileNav.setAttribute('aria-label', 'Основная навигация');

      const animateMenu = open => {
        const links = $('.mobile-nav a', menuWrap);
        document.body.classList.toggle('menu-open', open);
        menuButton.setAttribute('aria-expanded', String(open));
        if (!open) {
          links.forEach(link => {
            link.style.opacity = '';
            link.style.transform = '';
            link.style.transitionDelay = '';
          });
          return;
        }
        links.forEach((link, index) => {
          link.style.opacity = '0';
          link.style.transform = 'translateY(-14px)';
          link.style.transition = 'opacity .42s var(--ease), transform .42s var(--ease)';
          link.style.transitionDelay = `${index * 45}ms`;
          requestAnimationFrame(() => {
            link.style.opacity = '1';
            link.style.transform = 'translateY(0)';
          });
        });
      };

      menuWrap.addEventListener('toggle', () => animateMenu(menuWrap.open));
      mobileNav.addEventListener('click', event => {
        if (event.target.closest('a')) {
          menuWrap.removeAttribute('open');
          animateMenu(false);
        }
      });
    }
  }

  document.querySelectorAll('.mobile-nav a').forEach(a => a.addEventListener('click', () => {
    const d = a.closest('details');
    if (d) d.removeAttribute('open');
  }));

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

  // All public request forms use either id=request-form or the legacy id=repairForm.
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

        const response = await fetch(`${API_BASE}/api/requests`, {
          method: 'POST',
          body: fd
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || 'Не удалось отправить заявку');
        }

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
