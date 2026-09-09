(() => {
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Content is always visible. The observer only adds the motion state,
  // so a disabled/blocked JS runtime can never leave the page blank.
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });

  $$('.reveal').forEach((el, i) => {
    if (!prefersReduced) {
      el.classList.add('reveal-ready');
      // Elements already in the first viewport animate immediately.
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * .92 && r.bottom > 0) el.classList.add('in');
      observer.observe(el);
    } else {
      el.classList.add('in');
    }
  });

  if (!prefersReduced) {
    const orbs = $$('.parallax');
    let ticking = false;
    const updateParallax = () => {
      const y = window.scrollY;
      orbs.forEach((orb, i) => {
        orb.style.transform = `translate3d(0,${y * (i % 2 ? -0.045 : 0.025)}px,0)`;
      });
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateParallax);
    }, { passive: true });
    updateParallax();

    const glow = document.querySelector('.cursor-glow');
    window.addEventListener('pointermove', (e) => {
      if (glow) glow.style.transform = `translate3d(${e.clientX - 160}px,${e.clientY - 160}px,0)`;
    }, { passive: true });

    bindMagnetic();
    bindTilt();
  }

  function bindMagnetic(root = document) {
    $$('.magnetic', root).forEach((btn) => {
      if (btn.dataset.magneticBound) return;
      btn.dataset.magneticBound = '1';
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        btn.style.transform = `translate(${(e.clientX-r.left-r.width/2)*.10}px,${(e.clientY-r.top-r.height/2)*.10}px)`;
      });
      btn.addEventListener('pointerleave', () => btn.style.transform = '');
    });
  }

  function bindTilt(root = document) {
    $$('.cinematic-frame', root).forEach((frame) => {
      if (frame.dataset.tiltBound) return;
      frame.dataset.tiltBound = '1';
      frame.addEventListener('pointermove', (e) => {
        const r = frame.getBoundingClientRect();
        const x = (e.clientX-r.left)/r.width-.5;
        const y = (e.clientY-r.top)/r.height-.5;
        frame.style.transform = `perspective(900px) rotateY(${x*4}deg) rotateX(${-y*4}deg) translateY(-5px)`;
      });
      frame.addEventListener('pointerleave', () => frame.style.transform = '');
    });
  }

  $$('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        if (prefersReduced) { el.textContent = target; io.disconnect(); return; }
        let t0;
        const tick = (t) => {
          if (!t0) t0 = t;
          const p = Math.min((t - t0) / 900, 1);
          el.textContent = Math.round(target * (1 - Math.pow(1-p, 3)));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        io.disconnect();
      });
    }, { threshold: .55 });
    io.observe(el);
  });

  // Mobile menu
  const header = document.querySelector('.site-header');
  const menu = document.querySelector('.menu');
  menu?.addEventListener('click', () => {
    header?.classList.toggle('open');
    document.body.classList.toggle('menu-open');
  });
  $$('.mobile-menu a').forEach(a => a.addEventListener('click', () => {
    header?.classList.remove('open');
    document.body.classList.remove('menu-open');
  }));

  // Cinematic page transition for internal navigation.
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link || prefersReduced || link.target === '_blank') return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.hash || url.pathname === location.pathname) return;
    e.preventDefault();
    document.body.classList.add('page-exit');
    setTimeout(() => location.href = url.href, 380);
  });

  function initForm() {
    const form = document.querySelector('#repairForm');
    if (!form) return;
    const steps = $$('.form-step', form);
    const fill = form.querySelector('.progress-fill');
    const num = form.querySelector('.form-progress b');
    let current = 1;

    const show = (n) => {
      current = n;
      steps.forEach(s => s.classList.toggle('active', Number(s.dataset.step) === n));
      if (fill) fill.style.width = `${(n/3)*100}%`;
      if (num) num.textContent = String(n).padStart(2, '0');
    };

    $$('.next-step', form).forEach(btn => btn.addEventListener('click', () => {
      const active = form.querySelector('.form-step.active');
      const required = $$('input[required],select[required],textarea[required]', active);
      const empty = required.find(x => !String(x.value).trim());
      if (empty) {
        active.classList.add('shake');
        setTimeout(() => active.classList.remove('shake'), 450);
        empty.focus();
        return;
      }
      show(Math.min(current + 1, 3));
    }));
    $$('.prev-step', form).forEach(btn => btn.addEventListener('click', () => show(Math.max(current - 1, 1))));

    form.querySelector('#files')?.addEventListener('change', (e) => {
      const files = [...e.target.files];
      const note = form.querySelector('.file-note');
      const bad = files.find(f => f.size > 20 * 1024 * 1024);
      note.textContent = bad ? 'Один из файлов больше 20 МБ. Уменьшите его размер.' : files.length ? `Выбрано файлов: ${files.length}` : 'Можно добавить фото, видео или PDF.';
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const files = [...(form.querySelector('#files')?.files || [])].map(f => f.name);
      const text = `ЗАЯВКА ROSEEN\n\nНаправление: ${data.get('category')}\nМодель / устройство: ${data.get('model') || 'не указано'}\n\nНеисправность:\n${data.get('symptom')}\n\nКонтакт: ${data.get('contact')}\nДополнительно: ${data.get('comment') || '—'}\nФайлы: ${files.length ? files.join(', ') : 'нет'}`;
      form.querySelector('#requestPreview').value = text;
      form.querySelector('.form-success').hidden = false;
      steps.forEach(s => s.classList.remove('active'));
      form.querySelector('.form-progress').style.display = 'none';
    });

    form.querySelector('#copyRequest')?.addEventListener('click', async (e) => {
      const text = form.querySelector('#requestPreview').value;
      try { await navigator.clipboard.writeText(text); e.currentTarget.textContent = 'Скопировано ✓'; }
      catch { e.currentTarget.textContent = 'Выделите текст вручную'; }
    });
  }
  initForm();

  function initInnerPage() {
    const root = document.querySelector('#page-content');
    const page = document.body.dataset.direction;
    if (!root || !page) return;
    const data = {
      robotics:{k:'01 / ROBOTICS',title:'Робототехника',lead:'Диагностика и ремонт сервисных роботов, приводов, датчиков, электроники и систем управления.',img:'assets/robot.svg',items:['Ошибка движения или навигации','Проблемы с зарядкой и питанием','Датчики и приводные узлы','Платы и электронные модули']},
      electronics:{k:'02 / ELECTRONICS',title:'Электроника',lead:'Поиск неисправностей на уровне узла, платы и цепи — без замены исправных компонентов наугад.',img:'assets/electronics.svg',items:['Не включается / нестабильная работа','Питание и DC/DC-цепи','Разъёмы, кабели и межблочные линии','Следы влаги и коррозии']},
      appliances:{k:'03 / APPLIANCES',title:'Бытовая техника',lead:'Ремонт бытовых приборов со сложной электроникой, датчиками и системами управления.',img:'assets/appliance.svg',items:['Не запускается программа','Ошибка нагрева / слива / подачи воды','Сбои управления и датчиков','Повторяющиеся ошибки']},
      diagnostika:{k:'SERVICE / 01',title:'Диагностика',lead:'Фиксируем симптом, проверяем систему и отделяем первопричину от следствия.',img:'assets/electronics.svg',items:['Первичный осмотр','Проверка питания и сигналов','Тест узлов и датчиков','Заключение и план ремонта']},
      remont:{k:'SERVICE / 02',title:'Ремонт',lead:'Восстанавливаем неисправный узел и проверяем технику под рабочей нагрузкой.',img:'assets/robot.svg',items:['Ремонт или замена узла','Восстановление соединений','Настройка после ремонта','Финальное тестирование']},
      servis:{k:'SERVICE / 03',title:'Обслуживание',lead:'Профилактика, очистка, настройка и контроль состояния техники до появления отказа.',img:'assets/appliance.svg',items:['Очистка и профилактика','Контроль рабочих параметров','Настройка и калибровка','Рекомендации по эксплуатации']},
      engineering:{k:'SERVICE / 04',title:'Инженерная помощь',lead:'Разбираем сложные и повторяющиеся неисправности, когда стандартная замена детали не решает проблему.',img:'assets/robot.svg',items:['Повторяющиеся ошибки','Нестандартные неисправности','Технический аудит','Поиск системной причины']}
    }[page];
    if (!data) return;
    document.title = `ROSEEN — ${data.title}`;
    root.innerHTML = `<section class="inner-hero section cinematic"><div class="scanline"></div><div class="orb orb-hero parallax"></div><div class="container inner-grid"><div class="reveal in"><div class="eyebrow"><i></i>${data.k}</div><h1>${data.title}</h1><p class="lead">${data.lead}</p><div class="actions"><a class="btn btn-primary magnetic" href="index.html#request">Оставить заявку ↗</a><a class="btn btn-ghost" href="index.html#directions">Все направления</a></div></div><div class="hero-art reveal in reveal-delay"><div class="art-frame cinematic-frame"><img src="${data.img}" alt="${data.title}"></div></div></div></section><section class="section dark-section"><div class="container"><div class="section-head reveal in"><div class="eyebrow"><i></i> ЧТО ПРОВЕРЯЕМ</div><h2>Ищем<br><em>причину.</em></h2></div><div class="fault-grid">${data.items.map((x,i)=>`<article class="fault-card reveal"><span>0${i+1}</span><h3>${x}</h3><p>Проверяем соответствующий узел, фиксируем результат и определяем дальнейший шаг.</p></article>`).join('')}</div></div></section><section class="section"><div class="container process-banner reveal in"><div><div class="eyebrow"><i></i> ПРОЦЕСС</div><h2>Симптом → причина → <em>результат.</em></h2><p>После диагностики вы получаете понятное объяснение неисправности и предложение по дальнейшим действиям.</p></div><a class="btn btn-primary magnetic" href="index.html#request">Запустить диагностику ↗</a></div></section>`;
    if (!prefersReduced) {
      $$('.reveal', root).forEach(el => { el.classList.add('reveal-ready'); observer.observe(el); });
      bindMagnetic(root); bindTilt(root);
    }
    // New orb was added after initial parallax binding.
    const orb = root.querySelector('.parallax');
    if (orb && !prefersReduced) orb.style.transform = `translate3d(0,${window.scrollY*.025}px,0)`;
  }
  initInnerPage();
})();
