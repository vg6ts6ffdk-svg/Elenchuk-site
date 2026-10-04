(() => {
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
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
        const focusable = [summary, ...all('.mobile-nav a, .mobile-nav button, .mobile-nav summary', menu)].filter(el => el.getClientRects().length);
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    matchMedia(document.body.dataset.storefront === 'preview' ? '(min-width: 1201px)' : '(min-width: 1101px)').addEventListener('change', event => { if (event.matches) closeMenu(); });
    addEventListener('pageshow', () => closeMenu());
  }

  const current = location.pathname.split('/').pop() || 'index.html';
  all('.nav a, .mobile-nav a').forEach(link => {
    if (link.getAttribute('href').split('#')[0] === current) link.setAttribute('aria-current', 'page');
  });

  const allowedTypes = new Set(['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','video/mp4','video/webm','video/quicktime','application/pdf']);
  let serviceWarmStarted = false;
  function warmService() {
    if (serviceWarmStarted || typeof window.ROSEEN_API_BASE !== 'string') return;
    let endpoint;
    try { endpoint = new URL(window.ROSEEN_API_BASE.replace(/\/$/, '') + '/api/health', location.origin); } catch { return; }
    if (endpoint.protocol !== 'https:' && !(['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname) && endpoint.origin === location.origin)) return;
    serviceWarmStarted = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    // Start the service while the visitor fills the form. No form data or
    // credentials are sent; this optional GET never changes a request result.
    fetch(endpoint.href, {credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer', signal:controller.signal})
      .catch(() => {}).finally(() => clearTimeout(timeout));
  }
  // Preserve the service/store handoff without loading the catalogue runtime.
  const context = new URLSearchParams(location.search);
  if (['selection','installation'].includes(context.get('requestMode'))) {
    const form = document.querySelector('#request-form');
    const sku = (context.get('serviceSku') || '').slice(0,128), equipment = (context.get('equipment') || '').slice(0,180);
    const model = form?.querySelector('[name=model]'), problem = form?.querySelector('[name=problem]');
    if(model && !model.value.trim()) model.value=equipment;
    if(problem && !problem.value.trim()) problem.value=[context.get('requestMode')==='installation'?'Нужна установка запчасти.':'Нужен подбор и проверка совместимости.',sku && `Артикул / запрос: ${sku}`,equipment && `Оборудование: ${equipment}`].filter(Boolean).join('\n');
  }
  all('#request-form, #repairForm').forEach(form => {
    form.addEventListener('focusin', warmService, {once:true});
    form.addEventListener('pointerdown', warmService, {once:true});
    const submit = form.querySelector('[type="submit"]');
    const status = form.querySelector('.form-status');
    const fileInput = form.querySelector('[name="files"]');
    const fileHelp = form.querySelector('#file-help');
    form.addEventListener('invalid', event => {
      const details=event.target.closest('details');
      if(details)details.open=true;
    },true);
    const describeFiles = () => {
      const files = [...(fileInput?.files || [])];
      const size = files.reduce((sum, file) => sum + file.size, 0);
      const invalid = files.length > 3 || size > 3 * 1024 * 1024;
      fileInput?.setCustomValidity(invalid ? 'До 3 файлов и 3 МБ суммарно. Для большого видео добавьте ссылку.' : '');
      if (fileHelp) {
        fileHelp.setAttribute('aria-live', 'polite');
        fileHelp.textContent = files.length
          ? `Выбрано файлов: ${files.length}, ${(size / 1024 / 1024).toFixed(2)} МБ. ${invalid ? 'Лимит превышен: уберите лишние файлы или добавьте ссылку на видео.' : 'Лимит: 3 файла и 3 МБ суммарно.'}`
          : 'До 3 файлов, суммарно до 3 МБ. Для большого видео используйте ссылку выше.';
      }
    };
    fileInput?.addEventListener('change', describeFiles);
    form.addEventListener('reset', () => { setTimeout(describeFiles, 0); });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (submit.disabled) return;
      status.classList.add('show');
      status.classList.remove('is-error','is-success');
      status.textContent = 'Проверяем заявку…';
      try {
        if (typeof window.ROSEEN_API_BASE !== 'string') throw new Error('Не загрузилась настройка сервиса. Обновите страницу.');
        const data = new FormData(form);
        if(String(data.get('website') || '').trim()) throw new Error('Не удалось отправить форму. Обновите страницу и повторите.');
        for (const [target, source] of [['equipment_type','category'],['problem','symptom'],['model','model'],['contact','contact']]) {
          data.set(target, String(data.get(target) || data.get(source) || '').trim());
          if (source !== target) data.delete(source);
        }
        if (!data.get('equipment_type') || !data.get('problem') || !data.get('contact')) throw new Error('Заполните направление, описание неисправности и контакт.');
        const video = String(form.querySelector('#video_link')?.value || data.get('video_link') || '').trim();
        data.delete('video_link');
        if (video) {
          let url;
          try { url = new URL(video); } catch { throw new Error('Укажите полную ссылку на видео, начиная с https://.'); }
          if (url.protocol !== 'https:' || url.username || url.password || video.length > 1000) throw new Error('Нужна HTTPS-ссылка без логина и пароля в адресе.');
          const problem = `${data.get('problem')}\n\nВидео: ${url.href}`;
          if (problem.length > 5000) throw new Error('Сократите описание: вместе со ссылкой допустимо до 5000 символов.');
          data.set('problem', problem);
        }
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
          const endpoint=new URL(window.ROSEEN_API_BASE.replace(/\/$/, '') + '/api/requests',location.origin);
          if(endpoint.protocol!=='https:' && !(['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname) && endpoint.origin===location.origin)) throw new Error('Сервис заявок должен использовать HTTPS. Данные остались в форме.');
          response = await fetch(endpoint.href, { method: 'POST', body: data, signal: controller.signal });
        } finally { clearTimeout(timeout); }
        const result = await response.json().catch(() => null);
        if (!response.ok || !Number.isInteger(result?.id)) throw new Error(result?.error || 'Сервис не подтвердил получение заявки. Данные сохранены в форме.');
        status.textContent = `Заявка №${result.id} принята. Сохраните номер — мы свяжемся по указанному контакту.`;
        status.classList.add('is-success');
        try { window.ROSEEN_TRACK?.('request_sent',{form_id:form.id}); } catch { /* Optional analytics cannot break a saved request. */ }
        form.reset();
      } catch (error) {
        status.classList.add('is-error');
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
