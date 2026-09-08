(function(){
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Apple-inspired scroll story: the copy changes as the user passes through
     four scroll zones. The trigger zones are the section's own scroll progress,
     so this works reliably on mobile Safari as well as desktop browsers. */
  document.querySelectorAll('[data-scroll-story]').forEach((story) => {
    const stages = Array.from(story.querySelectorAll('[data-story-stage]'));
    const title = story.querySelector('[data-story-title]');
    const kicker = story.querySelector('[data-story-kicker]');
    const copy = story.querySelector('.scroll-story-copy');
    const orb = story.querySelector('.scroll-story-orb');
    const sticky = story.querySelector('.scroll-story-sticky');
    if (!stages.length || !title || !copy) return;

    const data = stages.map((stage) => ({
      title: stage.dataset.title || stage.textContent.trim(),
      kicker: stage.dataset.kicker || '',
      text: stage.dataset.text || copy.textContent
    }));

    let active = -1;
    let timer = null;

    const setActive = (index, animate = true) => {
      index = Math.max(0, Math.min(stages.length - 1, index));
      if (index === active) return;
      active = index;
      stages.forEach((stage, i) => stage.classList.toggle('is-active', i === active));
      const item = data[active];
      if (animate && !reduced) {
        sticky.classList.add('is-changing');
        clearTimeout(timer);
        timer = setTimeout(() => {
          title.textContent = item.title;
          if (kicker) kicker.textContent = item.kicker;
          copy.textContent = item.text;
          sticky.classList.remove('is-changing');
        }, 150);
      } else {
        title.textContent = item.title;
        if (kicker) kicker.textContent = item.kicker;
        copy.textContent = item.text;
        sticky.classList.remove('is-changing');
      }
    };

    let ticking = false;
    const render = () => {
      ticking = false;
      const rect = story.getBoundingClientRect();
      const max = Math.max(1, story.offsetHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / max));
      const raw = progress * stages.length;
      const index = Math.min(stages.length - 1, Math.floor(raw));
      const local = raw - index;
      setActive(index, true);

      if (orb && !reduced) {
        const x = Math.sin(progress * Math.PI * 1.3) * 90;
        const y = progress * 260;
        const scale = 1 + progress * .18;
        orb.style.transform = `translate3d(calc(-50% + ${x}px), ${y}px, 0) scale(${scale})`;
      }

      stages.forEach((stage, i) => {
        const distance = i - index;
        if (!reduced) stage.style.setProperty('--story-progress', String(Math.max(0, 1 - Math.abs(distance - local))));
      });
    };

    const request = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(render);
      }
    };

    if (reduced) {
      setActive(0, false);
      return;
    }

    window.addEventListener('scroll', request, {passive:true});
    window.addEventListener('resize', request);
    setActive(0, false);
    request();
  });

  /* Reveals are additive only. If IntersectionObserver is unavailable,
     content remains visible rather than disappearing. */
  if (!reduced && 'IntersectionObserver' in window) {
    const reveal = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          reveal.unobserve(entry.target);
        }
      });
    }, {threshold:0.08, rootMargin:'0px 0px -4% 0px'});

    document.querySelectorAll('.card, .process, .profile-card, .feature, .statement, .contact-main, .contact-side').forEach((el) => {
      el.classList.add('scroll-reveal');
      reveal.observe(el);
    });
  } else {
    document.querySelectorAll('.card, .process, .profile-card, .feature, .statement, .contact-main, .contact-side').forEach((el) => el.classList.add('is-visible'));
  }

  /* Premium homepage scroll section. */
  document.querySelectorAll('[data-premium-scroll]').forEach((story) => {
    const steps = Array.from(story.querySelectorAll('.premium-step'));
    const copy = story.querySelector('.premium-copy');
    const title = story.querySelector('[data-premium-title]');
    const kicker = story.querySelector('[data-premium-kicker]');
    const text = story.querySelector('[data-premium-text]');
    const link = story.querySelector('[data-premium-link]');
    const count = story.querySelector('[data-premium-count]');
    const portraitWrap = story.querySelector('.premium-portrait-wrap');
    const portrait = story.querySelector('.premium-portrait');
    const ring = story.querySelector('.premium-ring');
    const orbA = story.querySelector('.premium-orb-a');
    const orbB = story.querySelector('.premium-orb-b');
    if (!steps.length || !title || !text) return;

    const renderStep = (s, index) => {
      title.textContent = s.dataset.title;
      kicker.textContent = s.dataset.kicker;
      text.textContent = s.dataset.text;
      if (link && s.dataset.link) { link.href = s.dataset.link; link.firstChild.textContent = (s.dataset.linkLabel || 'Подробнее') + ' '; }
      if (count) count.textContent = String(index + 1).padStart(2, '0') + '—04';
    };

    if (reduced) { renderStep(steps[0], 0); return; }

    let active = 0, ticking = false, timer = null;
    const render = () => {
      ticking = false;
      const rect = story.getBoundingClientRect();
      const max = Math.max(1, story.offsetHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / max));
      const raw = progress * steps.length;
      const index = Math.min(steps.length - 1, Math.floor(raw));
      const local = raw - index;
      if (index !== active) {
        active = index;
        const s = steps[index];
        copy.classList.add('is-changing');
        clearTimeout(timer);
        timer = setTimeout(() => { renderStep(s,index); copy.classList.remove('is-changing'); }, 130);
        steps.forEach((x,i)=>x.classList.toggle('is-active',i===index));
      }
      const scale = 1 + progress * .085;
      const x = Math.sin(progress * Math.PI) * 18;
      const y = Math.cos(progress * Math.PI * 1.2) * -10;
      portraitWrap.style.transform = `translate3d(${x}px,${y}px,0) scale(${scale})`;
      portrait.style.transform = `scale(${1 + local * .018})`;
      ring.style.transform = `rotate(${progress * 38}deg) scale(${1 + progress * .05})`;
      orbA.style.transform = `translate3d(${-progress * 80}px,${progress * 160}px,0)`;
      orbB.style.transform = `translate3d(${progress * 100}px,${-progress * 120}px,0)`;
    };
    const request = () => { if (!ticking) { ticking=true; requestAnimationFrame(render); } };
    window.addEventListener('scroll',request,{passive:true});
    window.addEventListener('resize',request);
    render();
  });
})();
