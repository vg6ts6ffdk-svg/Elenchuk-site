(function(){
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Scroll-linked "Apple-style" storytelling blocks.
  // The page remains usable without JS; JS only adds progressive visual emphasis.
  document.querySelectorAll('[data-scroll-story]').forEach((story) => {
    const stages = Array.from(story.querySelectorAll('[data-story-stage]'));
    const title = story.querySelector('[data-story-title]');
    const kicker = story.querySelector('[data-story-kicker]');
    if (!stages.length || !title) return;

    let active = -1;
    const setActive = (index) => {
      index = Math.max(0, Math.min(stages.length - 1, index));
      if (index === active) return;
      active = index;
      stages.forEach((stage, i) => stage.classList.toggle('is-active', i === active));
      const current = stages[active];
      title.textContent = current.dataset.title || current.textContent.trim();
      if (kicker && current.dataset.kicker) kicker.textContent = current.dataset.kicker;
    };

    if (reduced) {
      setActive(0);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const index = stages.indexOf(entry.target);
        if (index >= 0) setActive(index);
      });
    }, {root:null, rootMargin:'-42% 0px -42% 0px', threshold:0});

    stages.forEach((stage) => observer.observe(stage));
    setActive(0);
  });

  // Gentle reveal for cards and sections as they enter the viewport.
  if (!reduced && 'IntersectionObserver' in window) {
    const reveal = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          reveal.unobserve(entry.target);
        }
      });
    }, {threshold:0.12, rootMargin:'0px 0px -6% 0px'});
    document.querySelectorAll('.card, .process, .profile-card, .feature, .statement, .contact-main, .contact-side').forEach((el) => {
      el.classList.add('scroll-reveal');
      reveal.observe(el);
    });
  }

  // Premium hero: scroll progress drives the portrait scale and rotating copy.
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

    if (reduced) {
      const first = steps[0];
      title.textContent = first.dataset.title;
      kicker.textContent = first.dataset.kicker;
      text.textContent = first.dataset.text;
      if (link && first.dataset.link) { link.href = first.dataset.link; link.firstChild.textContent = (first.dataset.linkLabel || 'Подробнее') + ' '; }
      if (count) count.textContent = '01—04';
      return;
    }

    let active = 0;
    let ticking = false;

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
        window.setTimeout(() => {
          title.textContent = s.dataset.title;
          kicker.textContent = s.dataset.kicker;
          text.textContent = s.dataset.text;
          if (link && s.dataset.link) { link.href = s.dataset.link; link.firstChild.textContent = (s.dataset.linkLabel || 'Подробнее') + ' '; }
          if (count) count.textContent = String(index + 1).padStart(2, '0') + '—04';
          copy.classList.remove('is-changing');
        }, 110);
        steps.forEach((x, i) => x.classList.toggle('is-active', i === index));
      }

      const p = progress;
      const scale = 1 + Math.min(.085, p * .085);
      const x = Math.sin(p * Math.PI) * 18;
      const y = Math.cos(p * Math.PI * 1.2) * -10;
      portraitWrap.style.transform = `translate3d(${x}px,${y}px,0) scale(${scale})`;
      portrait.style.transform = `scale(${1 + local * .018})`;
      ring.style.transform = `rotate(${p * 38}deg) scale(${1 + p * .05})`;
      orbA.style.transform = `translate3d(${-p * 80}px,${p * 160}px,0)`;
      orbB.style.transform = `translate3d(${p * 100}px,${-p * 120}px,0)`;
    };

    const request = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(render);
      }
    };

    window.addEventListener('scroll', request, {passive:true});
    window.addEventListener('resize', request);
    render();
  });

})();
