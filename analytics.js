import { analytics as configured } from './scripts/analytics-settings.mjs';
(() => {
  if (!['roseen.ru','www.roseen.ru'].includes(location.hostname)) return;
  const metrikaId=Number(configured.metrikaId), ga4Id=configured.ga4Id;
  const hasMetrika=Number.isSafeInteger(metrikaId)&&metrikaId>0;
  const hasGa4=typeof ga4Id==='string'&&/^G-[A-Z0-9]+$/.test(ga4Id);
  if(!hasMetrika&&!hasGa4) return;
  const preference='roseen.analytics-consent.v1';
  let consent=false,started=false;
  const cleanUrl=value=>{try{const u=new URL(value,location.origin);return u.origin+u.pathname;}catch{return ''}};
  const inject=src=>{const el=document.createElement('script');el.src=src;el.async=true;document.head.append(el);};
  const saved=()=>{try{return localStorage.getItem(preference);}catch{return null;}};
  function start() {
    if(started||!consent) return;
    started=true;
    if(hasMetrika) {
      window.ym=window.ym||function(){(window.ym.a=window.ym.a||[]).push(arguments)};
      window.ym.l=Date.now();
      window.ym(metrikaId,'init',{clickmap:true,trackLinks:false,accurateTrackBounce:true,webvisor:configured.webvisor===true,trackHash:false,url:cleanUrl(location.href),referrer:cleanUrl(document.referrer)});
      inject('https://mc.yandex.ru/metrika/tag.js');
    }
    if(hasGa4) {
      window.dataLayer=window.dataLayer||[];
      window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};
      window.gtag('js',new Date());
      window.gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
      window.gtag('config',ga4Id,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false});
      window.gtag('event','page_view',{page_location:cleanUrl(location.href),page_referrer:cleanUrl(document.referrer)});
      inject('https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(ga4Id));
    }
  }
  // Only fixed fields: no contacts, request content, request IDs or target URLs.
  window.ROSEEN_TRACK=(event,fields={})=>{
    if(!consent||!started||!['request_sent','phone_click','messenger_click'].includes(event)) return;
    const payload={page_path:location.pathname};
    if(['request-form','repairForm'].includes(fields.form_id)) payload.form_id=fields.form_id;
    if(['telegram','whatsapp','viber','max'].includes(fields.messenger)) payload.messenger=fields.messenger;
    try {
      if(hasMetrika) window.ym(metrikaId,'reachGoal',event,payload);
      if(hasGa4) window.gtag('event',event==='request_sent'?'generate_lead':event,{...payload,transport_type:'beacon'});
    } catch { /* Analytics failure never changes the service result. */ }
  };
  const settingsButton=document.createElement('button');settingsButton.type='button';settingsButton.className='analytics-settings';settingsButton.textContent='Настройки аналитики';
  function choose(restoreFocus=false) {
    document.querySelector('.analytics-choice')?.remove();
    const panel=document.createElement('section');panel.className='analytics-choice';panel.setAttribute('aria-label','Аналитика сайта');
    const info=document.createElement('p');info.textContent='Разрешить аналитику посещений и действий на сайте? Форма заявки работает при любом выборе. Содержимое полей не передаётся.';
    const actions=document.createElement('div');actions.className='actions';
    for(const [value,label] of [['granted','Разрешить'],['denied','Без аналитики']]) {
      const button=document.createElement('button');button.type='button';button.className='btn '+(value==='granted'?'btn-primary':'btn-ghost');button.textContent=label;
      button.addEventListener('click',()=>{
        try{localStorage.setItem(preference,value);}catch{}
        consent=value==='granted';
        if(consent)start();else if(started){location.reload();return;}
        panel.remove();if(restoreFocus)settingsButton.focus();
      });actions.append(button);
    }
    panel.append(info,actions);document.body.append(panel);
    if(restoreFocus)panel.querySelector('button').focus();
  }
  settingsButton.addEventListener('click',()=>choose(true));document.querySelector('.footer-nav')?.append(settingsButton);
  if(saved()==='granted'){consent=true;start();}else if(saved()!=='denied')choose();
  function trackLink(event) {
    const a=event.target.closest?.('a[href]');if(!a)return;
    const raw=a.getAttribute('href');
    if(/^tel:/i.test(raw)) return window.ROSEEN_TRACK('phone_click');
    let u;try{u=new URL(a.href);}catch{return;}
    const host=u.hostname.replace(/^www\./,'');
    const messenger=['t.me','telegram.me'].includes(host)?'telegram':['wa.me','api.whatsapp.com'].includes(host)?'whatsapp':u.protocol==='viber:'?'viber':host==='max.ru'?'max':null;
    if(messenger)window.ROSEEN_TRACK('messenger_click',{messenger});
  }
  document.addEventListener('click',trackLink);
  document.addEventListener('auxclick',e=>{if(e.button===1)trackLink(e);});
})();
