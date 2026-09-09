(() => {
  const $ = (s, r=document) => [...r.querySelectorAll(s)];
  const menu = document.querySelector('.menu');
  menu?.addEventListener('click', () => document.body.classList.toggle('menu-open'));
  $$('.mobile-nav a').forEach(a => a.addEventListener('click', () => document.body.classList.remove('menu-open')));

  const revealItems = $$('.reveal');
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target)}
  }), {threshold:.08, rootMargin:'0px 0px -30px'});
  revealItems.forEach(el => io.observe(el));
  // Safety fallback: content must remain visible in static/full-page renderers.
  setTimeout(() => revealItems.forEach(el => el.classList.add('visible')), 1400);

  // Subtle cinematic image movement — disabled on touch/reduced-motion.
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches && matchMedia('(pointer:fine)').matches){
    const imgs = $$('.parallax-image');
    let ticking=false;
    const move=()=>{ticking=false; const y=scrollY; imgs.forEach(img=>{const r=img.closest('.media-wrap')?.getBoundingClientRect(); if(!r)return; const delta=(window.innerHeight/2-(r.top+r.height/2))*0.035; img.style.transform=`scale(1.04) translateY(${delta}px)`})};
    addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(move)}},{passive:true}); move();
  }

  const form=document.querySelector('#repairForm');
  form?.addEventListener('submit',e=>{
    e.preventDefault();
    const data=new FormData(form);
    const files=form.querySelector('[name="files"]')?.files?.length||0;
    const status=form.querySelector('.form-status');
    status.textContent=`Заявка подготовлена. Направление: ${data.get('category')||'не указано'}; модель: ${data.get('model')||'не указана'}. ${files?`Прикреплено файлов: ${files}.`:''}`;
    status.classList.add('show');
    form.reset();
  });

  $$('.magnetic').forEach(btn=>{
    if(!matchMedia('(pointer:fine)').matches)return;
    btn.addEventListener('pointermove',e=>{const r=btn.getBoundingClientRect();const x=(e.clientX-r.left-r.width/2)*.08;const y=(e.clientY-r.top-r.height/2)*.08;btn.style.transform=`translate(${x}px,${y}px)`});
    btn.addEventListener('pointerleave',()=>btn.style.transform='');
  });
})();
