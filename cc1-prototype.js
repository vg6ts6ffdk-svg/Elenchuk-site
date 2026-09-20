(() => {
  const section = document.querySelector('#exploded');
  const robot = document.querySelector('#robot');
  const parts = [...document.querySelectorAll('.part[data-x]')];
  const progressBar = document.querySelector('#progressBar');
  const title = document.querySelector('#stageTitle');
  const text = document.querySelector('#stageText');
  const label = document.querySelector('#partLabel');
  const stageItems = [...document.querySelectorAll('.stage-list li')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  const stages = [
    ['PUDU CC1', 'Собранное состояние. Начинаем с внешнего корпуса.'],
    ['Снимаем панели', 'Верхняя крышка, боковые панели и фронтальный модуль расходятся по направлениям доступа.'],
    ['Открываем баки', 'Баки чистой и грязной воды отделяются от центральной рамы.'],
    ['Доступ к электронике', 'Плата управления и аккумулятор вынесены из корпуса для читаемого exploded-view.'],
    ['Гидравлика и вакуум', 'Показываем турбину, блок подачи воды и всасывающий тракт как отдельную сервисную группу.'],
    ['Нижний модуль', 'Ходовая платформа и уборочный модуль завершают разборку. Прокрутка вверх собирает всё обратно.']
  ];

  const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));
  const smooth = t => t * t * (3 - 2 * t);

  const stageWindows = {
    'top-cover':[0.06,0.28],
    'shell-left':[0.10,0.35],
    'shell-right':[0.10,0.35],
    'front-shell':[0.13,0.36],
    'face':[0.14,0.38],
    'clean-tank':[0.28,0.52],
    'waste-tank':[0.28,0.52],
    'control-board':[0.42,0.67],
    'battery':[0.44,0.69],
    'turbine':[0.56,0.80],
    'water-module':[0.56,0.80],
    'hose':[0.58,0.82],
    'drive-base':[0.68,0.95],
    'cleaning-deck':[0.70,1],
    'inner-frame':[0.76,1],
    'shadow':[0,1]
  };

  function partKey(el){
    return [...el.classList].find(c => stageWindows[c]) || '';
  }

  function localProgress(global, el){
    const [start,end] = stageWindows[partKey(el)] || [0,1];
    return smooth(clamp((global - start) / (end - start)));
  }

  function setPartVars(el,p){
    el.style.setProperty('--p',p.toFixed(4));
    el.style.setProperty('--tx',el.dataset.x + 'px');
    el.style.setProperty('--ty',el.dataset.y + 'px');
    el.style.setProperty('--tz',el.dataset.z + 'px');
    el.style.setProperty('--rr',el.dataset.r + 'deg');
    if (el.classList.contains('shadow')) el.style.opacity = String(1 - p * .46);
  }

  function update(){
    if (!section) return;
    const rect = section.getBoundingClientRect();
    const total = section.offsetHeight - innerHeight;
    const progress = reduced.matches ? .82 : clamp(-rect.top / total);

    progressBar.style.width = (progress * 100).toFixed(1) + '%';

    parts.forEach(el => setPartVars(el, localProgress(progress, el)));

    const stage = Math.min(stages.length - 1, Math.floor(progress * stages.length));
    title.textContent = stages[stage][0];
    text.textContent = stages[stage][1];
    stageItems.forEach((item,i) => item.classList.toggle('active', i === stage));

    const namedParts = parts.filter(p => p.dataset.name);
    let active = namedParts[0];
    let best = Infinity;
    for (const el of namedParts){
      const [start,end] = stageWindows[partKey(el)] || [0,1];
      const mid = (start + end) / 2;
      const d = Math.abs(progress - mid);
      if (d < best){best = d; active = el;}
    }
    label.textContent = progress < .04 ? 'PUDU CC1 · assembled' : active.dataset.name;

    const yaw = (progress - .5) * -7;
    const lift = Math.sin(progress * Math.PI) * -10;
    robot.style.transform = `translate(-50%,-50%) translateY(${lift}px) rotateX(-2deg) rotateY(${yaw}deg)`;
  }

  let ticking = false;
  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  };

  addEventListener('scroll', requestUpdate, {passive:true});
  addEventListener('resize', requestUpdate);
  reduced.addEventListener?.('change', requestUpdate);
  update();
})();