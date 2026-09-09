(() => {
  const $ = (s, r=document) => [...r.querySelectorAll(s)];
  document.querySelectorAll('.mobile-nav a').forEach(a => a.addEventListener('click', () => { const d = a.closest('details'); if (d) d.removeAttribute('open'); }));

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


/* ROSEEN_BACKEND_FORM */
(() => {
  const form = document.querySelector("#request-form, form.request-form");
  if (!form) return;
  const submit = form.querySelector('button[type="submit"], button');
  const status = document.createElement("div");
  status.className = "request-status";
  form.appendChild(status);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submit) submit.disabled = true;
    status.textContent = "Отправляем заявку…";
    try {
      const fd = new FormData(form);
      const type = fd.get("equipment_type") || fd.get("type") || "";
      const model = fd.get("model") || "";
      const problem = fd.get("problem") || fd.get("description") || "";
      const contact = fd.get("contact") || "";
      fd.set("equipment_type", type);
      fd.set("model", model);
      fd.set("problem", problem);
      fd.set("contact", contact);
      const response = await fetch("/api/requests", { method:"POST", body:fd });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось отправить заявку");
      status.textContent = `Заявка №${data.id} принята. Мы получили данные и файлы.`;
      form.reset();
    } catch (err) {
      status.textContent = err.message || "Ошибка отправки";
    } finally {
      if (submit) submit.disabled = false;
    }
  });
})();
