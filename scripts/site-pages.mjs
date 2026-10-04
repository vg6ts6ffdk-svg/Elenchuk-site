import fs from 'node:fs';
export const settings = JSON.parse(fs.readFileSync(new URL('../site-settings.json', import.meta.url), 'utf8'));
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const url = file => settings.url + (file === 'index.html' ? '/' : '/' + file);
const labels = { 'directions.html':'Направления', 'services.html':'Услуги', 'about.html':'О компании', 'faq.html':'FAQ', 'contacts.html':'Контакты', 'news.html':'Новости', 'robotics.html':'Робототехника', 'electronics.html':'Электроника', 'professional.html':'Профессиональное оборудование', 'diagnostika.html':'Диагностика', 'remont.html':'Ремонт', 'servis.html':'Обслуживание', 'engineering.html':'Инжиниринг', 'shop.html':'Магазин', 'cart.html':'Корзина', 'account.html':'Кабинет' };
const services = [
  ['diagnostika.html','Диагностика','Диагностика робототехники, электроники и профессионального оборудования.'],
  ['remont.html','Ремонт','Ремонт робототехники, электроники и профессионального оборудования.'],
  ['servis.html','Обслуживание','Техническое обслуживание, очистка, профилактика и контроль состояния оборудования.'],
  ['engineering.html','Инжиниринг','Инженерная помощь, настройка и восстановление работы оборудования.']
];
export function businessSchema(config = settings) {
  const business = {'@type':'Organization','@id':settings.url + '/#business',name:config.name,alternateName:config.alternateName,url:settings.url,logo:settings.url + '/assets/brand/roseen-wordmark.svg'};
  if(config.telephone) {
    if(!/^\+[1-9]\d{6,14}$/.test(config.telephone)) throw new Error('Confirmed telephone must use E.164');
    business.telephone=config.telephone;
  }
  if(config.address) {
    for(const key of ['streetAddress','addressLocality','addressCountry']) if(!config.address[key]) throw new Error('Incomplete confirmed postal address');
    business['@type']='LocalBusiness'; business.address={'@type':'PostalAddress',...config.address};
  }
  if(config.geo) {
    const {latitude,longitude}=config.geo;
    if(!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180||!config.address) throw new Error('Invalid confirmed location');
    business.geo={'@type':'GeoCoordinates',latitude,longitude};
  }
  if(config.openingHoursSpecification?.length) {
    const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    business.openingHoursSpecification=config.openingHoursSpecification.map(h=>{
      if(!Array.isArray(h.dayOfWeek)||!h.dayOfWeek.every(d=>days.includes(d))||![h.opens,h.closes].every(t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) throw new Error('Invalid confirmed opening hours');
      return {'@type':'OpeningHoursSpecification',...h,dayOfWeek:h.dayOfWeek.map(d=>'https://schema.org/'+d)};
    });
  }
  if(config.sameAs?.length) {
    if(!config.sameAs.every(u=>new URL(u).protocol==='https:')) throw new Error('Confirmed profile URLs must use HTTPS');
    business.sameAs=config.sameAs;
  }
  return business;
}
export function crumbs(html,file) {
  if(['index.html','404.html'].includes(file)) return [];
  const title=text(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1]||labels[file]||'');
  const parent=/^(robotics|electronics|professional)\.html$/.test(file)?'directions.html'
    :services.some(s=>s[0]===file)?'services.html':/^briefing-/.test(file)?'news.html'
    :/^(shop-|product-)/.test(file)?'shop.html':null;
  return [['Главная','index.html'],...(parent?[[labels[parent],parent]]:[]),[labels[file]||title,file]];
}
export function structuredData(html,file,config=settings) {
  const graph=[businessSchema(config)];
  for(const [page,name,description] of services) if(['index.html','services.html',page].includes(file)) graph.push({'@type':'Service','@id':url(page)+'#service',name,serviceType:name,description,url:url(page),provider:{'@id':settings.url+'/#business'}});
  if(file==='faq.html') {
    const mainEntity=[...html.matchAll(/<details\b[^>]*class="[^"]*\bfaq\b[^"]*"[^>]*>([\s\S]*?)<\/details>/g)].map(m=>({'@type':'Question',name:text(m[1].match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1]||''),acceptedAnswer:{'@type':'Answer',text:text(m[1].replace(/<summary[^>]*>[\s\S]*?<\/summary>/,''))}}));
    if(mainEntity.length) graph.push({'@type':'FAQPage','@id':url(file)+'#faq',mainEntity});
  }
  const path=crumbs(html,file);
  if(path.length) graph.push({'@type':'BreadcrumbList',itemListElement:path.map(([name,page],i)=>({'@type':'ListItem',position:i+1,name,item:url(page)}))});
  return {'@context':'https://schema.org','@graph':graph};
}
export function sitePage(html,file,{storefront=false,config=settings}={}) {
  if(!html.includes('site-header')) return html;
  let out=html;
  const section=services.some(s=>s[0]===file)?'services.html':file;
  const primary=[['index.html','Главная'],['services.html','Услуги'],['about.html','О компании'],['faq.html','FAQ'],['contacts.html','Контакты']];
  const links=primary.map(([href,name])=>`<a href="${href}"${href===file?' aria-current="page"':href===section?' aria-current="location"':''}>${name}</a>`).join('');
  const secondary=[['directions.html','Направления'],['news.html','Новости'],...(storefront?[['shop.html','Магазин'],['cart.html','Корзина'],['account.html','Кабинет']]:[])];
  const extra=secondary.map(([href,name])=>`<a href="${href}"${href===file?' aria-current="page"':((/^briefing-/.test(file)&&href==='news.html')||(/^(shop-|product-)/.test(file)&&href==='shop.html'))?' aria-current="location"':''}>${name}</a>`).join('');
  out=out.replace(/<nav\b[^>]*class="nav"[^>]*>[\s\S]*?<\/nav>/,`<nav class="nav" aria-label="Основная навигация">${links}</nav>`);
  out=out.replace(/<nav\b[^>]*class="mobile-nav"[^>]*>[\s\S]*?<\/nav>/,`<nav id="mobile-menu" class="mobile-nav" aria-label="Мобильная навигация">${links}<a href="contacts.html#request">Оставить заявку ↗</a><div class="mobile-secondary" role="group" aria-label="Другие разделы">${extra}</div></nav>`);
  const secondaryNav=`<nav class="container footer-nav" aria-label="Другие разделы">${extra}</nav>`;
  out=out.includes('<p class="illustration-note">')
    ?out.replace('<p class="illustration-note">',secondaryNav+'<p class="illustration-note">')
    :out.replace('</footer>',secondaryNav+'</footer>');
  out=out.replace(/<link\b[^>]*rel="preconnect"[^>]*>\s*/g,'');
  out=out.replace(/<link\b[^>]*href="\/?(?:style|brand|motion|store|briefings)\.css(?:\?[^"]*)?"[^>]*>\s*/g,'');
  out=out.replace(/<script\b[^>]*src="\/?(?:api-config|script|motion|store)\.js(?:\?[^"]*)?"[^>]*>[\s\S]*?<\/script>\s*/g,'');
  let head='<link rel="stylesheet" href="assets/site.min.css">\n<link rel="preload" href="assets/fonts/InterVariable.woff2" as="font" type="font/woff2" crossorigin>\n<script src="assets/app.min.js" defer></script>\n';
  if(/class="[^"]*\bstore-main\b/.test(out)) head+='<script src="assets/store.min.js" defer></script>\n';
  const path=crumbs(out,file);
  if(path.length) {
    const markup=`<nav class="breadcrumbs container" aria-label="Хлебные крошки"><ol>${path.map(([name,page],i)=>`<li>${i===path.length-1?`<span aria-current="page">${esc(name)}</span>`:`<a href="${page}">${esc(name)}</a>`}</li>`).join('')}</ol></nav>`;
    out=out.replace(/(<main\b[^>]*>)/,'$1'+markup).replace(/<nav class="store-breadcrumb"[^>]*>[\s\S]*?<\/nav>/g,'');
  }
  let hero=false;
  out=out.replace(/<img\b[^>]*>/g,tag=>{
    const critical=!hero && /class="[^"]*\b(?:hero-image|inner-image)\b/.test(tag);
    if(critical) {
      hero=true;
      const src=tag.match(/\bsrc="([^"]+)"/)?.[1], srcset=tag.match(/\bsrcset="([^"]+)"/)?.[1], sizes=tag.match(/\bsizes="([^"]+)"/)?.[1];
      head+=`<link rel="preload" as="image" href="${src}"${srcset?` imagesrcset="${srcset}" imagesizes="${sizes}"`:''} fetchpriority="high">\n`;
    }
    if(/src="assets\/robotics-(?:1280|640)\.webp"/.test(tag)) tag=tag.replace(/alt="[^"]*"/,'alt="AI-иллюстрация: уборочный робот со снятыми панелями в мастерской"');
    const headerLogo=tag.includes('rosin-wordmark.svg');
    if(!headerLogo) tag=tag.replace(/\s(?:loading|fetchpriority)="[^"]*"/g,'').replace(/>$/,critical?' loading="eager" fetchpriority="high">':' loading="lazy">');
    return tag;
  });
  out=out.replace(/<form\b(?=[^>]*(?:id="request-form"|id="repairForm"))[^>]*>/g,tag=>tag.replace(/action="[^"]*"/,`action="${settings.url.replace('://roseen.ru','://api.roseen.ru')}/api/requests"`).replace(/class="([^"]*)"/,'class="$1 ym-hide-content"')+'<div class="honeypot" aria-hidden="true"><label for="website">Оставьте это поле пустым</label><input id="website" name="website" type="text" tabindex="-1" autocomplete="off"></div>');
  if(out.includes('id="request-form"')) {
    out=out.replace(/(<input\b(?=[^>]*id="video_link")[^>]*?)\sname="video_link"/,'$1');
    out=out.replace(/(<span class="form-note">)(До 3 файлов)/,'<span class="form-note" id="file-help">$2');
    out=out.replace(/class="form-status"/, 'class="form-status" tabindex="-1"');
    out=out.replace(/<textarea\b(?=[^>]*(?:name="problem"|name="symptom"))[^>]*>/g,tag=>tag.replace(/>$/,' data-private="true" class="ym-disable-keys">'));
    out=out.replace(/<input\b(?=[^>]*(?:name="(?:contact|model)"|id="video_link"))[^>]*>/g,tag=>tag.replace(/>$/,' data-private="true" class="ym-disable-keys">'));
    out=out.replace(/(<noscript>\s*<p>)(JavaScript отключён\.)/,'$1$2 Ссылку на видео добавьте в описание проблемы.');
  }
  if(file==='index.html') out=out.replace(/(<section id="faq"[\s\S]*?)(<\/div>\s*<\/div>\s*<\/section>)/,'$1<p class="faq-more"><a href="faq.html">Все вопросы и ответы ↗</a></p>$2');
  if(config.cases?.length && file==='index.html') {
    if(!config.cases.every(c=>c.verified===true&&['title','problem','work','result'].every(k=>typeof c[k]==='string'&&c[k].trim()))) throw new Error('Only verified service cases may be published');
    const cards=config.cases.map(c=>`<article class="service-card"><h3>${esc(c.title)}</h3><p><b>Задача:</b> ${esc(c.problem)}</p><p><b>Работы:</b> ${esc(c.work)}</p><p><b>Результат:</b> ${esc(c.result)}</p></article>`).join('');
    out=out.replace('<section id="request"',`<section class="section" aria-labelledby="cases-title"><div class="container"><h2 id="cases-title">Выполненные работы</h2><div class="service-grid">${cards}</div></div></section><section id="request"`);
  }
  if(file!=='404.html') head+=`<script type="application/ld+json">${JSON.stringify(structuredData(out,file,config)).replace(/</g,'\\u003c')}</script>\n`;
  out=out.replace('</head>',head+'</head>');
  if(file==='404.html') out=out.replace(/\b(src|href)="(?!https?:|mailto:|tel:|data:|#|\/)([^"]+)"/g,'$1="/$2"');
  return out;
}
