(() => {
  const $ = (s, r = document) => [...r.querySelectorAll(s)];
  const API_BASE = (window.ROSEEN_API_BASE || '').replace(/\/$/, '');

  const currentPage = location.pathname.split('/').pop() || 'index.html';
  $('.site-header .nav a, .site-header .mobile-nav a').forEach(link => {
    const href = (link.getAttribute('href') || '').split('#')[0] || 'index.html';
    if (href === currentPage) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  const menuWrap = document.querySelector('.menu-wrap');
  const menuButton = menuWrap?.querySelector('.menu');
  if (menuWrap && menuButton) {
    const syncMenuState = () => {
      menuButton.setAttribute('aria-expanded', String(menuWrap.open));
      document.body.classList.toggle('menu-open', menuWrap.open);
    };

    menuWrap.open = false;
    syncMenuState();
    menuWrap.addEventListener('toggle', syncMenuState);
    menuWrap.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menuWrap.open = false;
        syncMenuState();
      });
    });
    addEventListener('pageshow', () => {
      menuWrap.open = false;
      syncMenuState();
    });
    addEventListener('keydown', event => {
      if (event.key === 'Escape' && menuWrap.open) {
        menuWrap.open = false;
        syncMenuState();
        menuButton.focus();
      }
    });
  }

  const revealItems = $('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    }), { threshold: 0.08, rootMargin: '0px 0px -30px' });
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

    form.addEventListener('submit', async event => {
      event.preventDefault();
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
      } catch (error) {
        if (status) status.textContent = error.message || 'Ошибка отправки';
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  }

  $('.magnetic').forEach(btn => {
    if (!matchMedia('(pointer:fine)').matches) return;
    btn.addEventListener('pointermove', event => {
      const r = btn.getBoundingClientRect();
      const x = (event.clientX - r.left - r.width / 2) * 0.08;
      const y = (event.clientY - r.top - r.height / 2) * 0.08;
      btn.style.transform = `translate(${x}px,${y}px)`;
    });
    btn.addEventListener('pointerleave', () => btn.style.transform = '');
  });
})();
