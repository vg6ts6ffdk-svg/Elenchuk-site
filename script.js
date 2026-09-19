(() => {
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const menu = document.querySelector('.menu-wrap');
  const summary = menu?.querySelector('summary');
  const closeMenu = (restoreFocus = false) => {
    if (!menu) return;
    menu.open = false;
    document.body.classList.remove('menu-open');
    summary?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) summary?.focus();
  };
  if (menu) {
    menu.addEventListener('toggle', () => {
      document.body.classList.toggle('menu-open', menu.open);
      summary.setAttribute('aria-expanded', String(menu.open));
    });
    menu.addEventListener('click', event => {
      if (event.target.closest('a')) closeMenu();
    });
    document.addEventListener('keydown', event => {
      if (!menu.open) return;
      if (event.key === 'Escape') { event.preventDefault(); closeMenu(true); }
      if (event.key === 'Tab') {
        const focusable = [summary, ...all('.mobile-nav a', menu)];
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    matchMedia('(min-width: 1101px)').addEventListener('change', event => { if (event.matches) closeMenu(); });
    addEventListener('pageshow', () => closeMenu());
  }

  document.body.classList.add('brand-ready');
  const brandEyebrow = document.querySelector('.hero .eyebrow');
  if (brandEyebrow && /ROBOTICS.*SERVICE.*ENGINEERING/i.test(brandEyebrow.textContent)) {
    brandEyebrow.classList.add('brand-sequence');
    brandEyebrow.innerHTML = '<i></i><span class="brand-token"><b>RO</b>BOTICS</span><span class="brand-token"><b>SE</b>RVICE</span><span class="brand-token"><b>EN</b>GINEERING</span>';
  }

  const current = location.pathname.split('/').pop() || 'index.html';
  all('.nav a, .mobile-nav a').forEach(link => {
    if (link.getAttribute('href').split('#')[0] === current) link.setAttribute('aria-current', 'page');
  });

  // Content is visible without JS. Only offscreen elements opt into reveal.
  const reveal = all('.reveal');
  if (!reduced.matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    }), { threshold: 0.06, rootMargin: '0px 0px -16px 0px' });
    reveal.forEach(el => {
      if (el.getBoundingClientRect().top > innerHeight) el.classList.add('reveal-ready');
      observer.observe(el);
    });
    reduced.addEventListener('change', event => {
      if (event.matches) { reveal.forEach(el => el.classList.remove('reveal-ready')); observer.disconnect(); }
    });
  }

  const fine = matchMedia('(pointer: fine)');
  all('.magnetic').forEach(button => {
    button.addEventListener('pointermove', event => {
      if (reduced.matches || !fine.matches) return;
      const rect = button.getBoundingClientRect();
      button.style.transform = `translate(${(event.clientX - rect.left - rect.width / 2) * .06}px, ${(event.clientY - rect.top - rect.height / 2) * .06}px)`;
    });
    button.addEventListener('pointerleave', () => { button.style.transform = ''; });
  });
  let ticking = false;
  const images = all('.parallax-image');
  const updateParallax = () => {
    ticking = false;
    images.forEach(img => {
      const wrap = img.closest('.media-wrap');
      if (!wrap || reduced.matches || !fine.matches) { img.style.transform = ''; return; }
      const rect = wrap.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > innerHeight) return;
      const offset = Math.max(-14, Math.min(14, (innerHeight / 2 - rect.top - rect.height / 2) * .025));
      img.style.transform = `translateY(${offset}px) scale(1.05)`;
    });
  };
  addEventListener('scroll', () => {
    if (!ticking && !reduced.matches && fine.matches) { ticking = true; requestAnimationFrame(updateParallax); }
  }, { passive: true });
  reduced.addEventListener('change', updateParallax);

  const allowedTypes = new Set(['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','video/mp4','video/webm','video/quicktime','application/pdf']);
  all('#request-form, #repairForm').forEach(form => {
    const submit = form.querySelector('[type="submit"]');
    const status = form.querySelector('.form-status');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (submit.disabled) return;
      status.classList.add('show');
      status.textContent = 'Проверяем заявку…';
      try {
        if (typeof window.ROSEEN_API_BASE !== 'string') throw new Error('Не загрузилась настройка сервиса. Обновите страницу.');
        const data = new FormData(form);
        for (const [target, source] of [['equipment_type','category'],['problem','symptom'],['model','model'],['contact','contact']]) {
          data.set(target, String(data.get(target) || data.get(source) || '').trim());
          if (source !== target) data.delete(source);
        }
        if (!data.get('equipment_type') || !data.get('problem') || !data.get('contact')) throw new Error('Заполните направление, описание неисправности и контакт.');
        const files = data.getAll('files').filter(file => file.size > 0);
        if (files.length > 3) throw new Error('Можно прикрепить не больше 3 файлов.');
        if (files.reduce((total, file) => total + file.size, 0) > 3 * 1024 * 1024) throw new Error('Общий размер файлов должен быть не больше 3 МБ.');
        for (const file of files) {
          if (file.size > 3 * 1024 * 1024) throw new Error('Каждый файл должен быть не больше 3 МБ.');
          if (file.type && !allowedTypes.has(file.type)) throw new Error('Выберите JPG, PNG, WebP, GIF, HEIC, PDF, MP4, MOV или WebM.');
        }
        data.delete('files');
        files.forEach(file => data.append('files', file));
        submit.disabled = true;
        form.setAttribute('aria-busy', 'true');
        status.textContent = 'Отправляем заявку. Не закрывайте страницу…';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120000);
        let response;
        try {
          response = await fetch(window.ROSEEN_API_BASE.replace(/\/$/, '') + '/api/requests', { method: 'POST', body: data, signal: controller.signal });
        } finally { clearTimeout(timeout); }
        const result = await response.json().catch(() => null);
        if (!response.ok || !Number.isInteger(result?.id)) throw new Error(result?.error || 'Сервис не подтвердил получение заявки. Данные сохранены в форме.');
        status.textContent = `Заявка №${result.id} принята. Сохраните номер — мы свяжемся по указанному контакту.`;
        form.reset();
      } catch (error) {
        status.textContent = error.name === 'AbortError'
          ? 'Ответ сервиса не получен вовремя. Заявка могла быть принята; сохраните данные и не отправляйте её многократно.'
          : error instanceof TypeError ? 'Нет соединения с сервисом. Проверьте интернет; данные остались в форме.' : error.message;
      } finally {
        submit.disabled = false;
        form.removeAttribute('aria-busy');
      }
    });
  });
})();
