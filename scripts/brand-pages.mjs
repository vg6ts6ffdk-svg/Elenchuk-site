/** Approved logo geometry 4.0, palette 4.1 and primary icons 4.3. */
export const brandIconLinks = '<link rel="icon" type="image/png" sizes="32x32" href="assets/brand/favicon-32.png">\n<link rel="icon" type="image/svg+xml" href="favicon.svg">\n<link rel="apple-touch-icon" sizes="180x180" href="assets/brand/apple-touch-icon.png">';
export function brandPage(html, file, { storefront = false } = {}) {
  if (!html.includes('site-header')) return html;
  if (/class="brand-wordmark"/.test(html)) throw new Error('Rejected text logo in ' + file);
  // Graphic source masters are preserved; build adds shared presentation only.
  let out = html
    .replace(/href="style\.css(?:\?[^"]*)?"/g, 'href="style.css"')
    .replace('</head>', '<meta name="theme-color" content="#16181D">\n<link rel="preconnect" href="https://rsms.me">\n<link rel="stylesheet" href="brand.css?v=graphite-brand-20261003">\n<link rel="stylesheet" href="motion.css?v=visible-motion-20261004">\n<script src="motion.js?v=visible-motion-20261004" defer></script>\n</head>');
  out = out.replace(/<link\b(?=[^>]*rel="(?:icon|apple-touch-icon)")[^>]*>\s*/g, '')
    .replace('</head>', brandIconLinks + '\n</head>');
  out = out.replace(/<img\b(?=[^>]*src="logo-approved\.svg")[^>]*>/g, (tag) => tag
    .replace('src="logo-approved.svg"','src="assets/brand/roseen-wordmark.svg"')
    .replace(/width="[^"]+"/,'width="1843.5385"').replace(/height="[^"]+"/,'height="200"'));
  out = out.replace(/class="([^"]*)"/g, (_, classes) => 'class="' + classes.split(/\s+/).filter(x => x && !['magnetic','parallax-image'].includes(x)).join(' ') + '"');
  out = out.replace(/<div class="eyebrow">\s*<i>\s*<\/i>\s*(?:РОБОТЫ\s*[•·]\s*СЕРВИС\s*[•·]\s*ИНЖИНИРИНГ|ROBOTICS\s*[•·]\s*SERVICE\s*[•·]\s*ENGINEERING)\s*<\/div>/g,
    '<div class="eyebrow brand-sequence" aria-label="Роботы · Сервис · Инжиниринг"><span class="brand-token"><b>РО</b>БОТЫ</span> · <span class="brand-token"><b>С</b>ЕРВИС</span> · <span class="brand-token"><b>ИН</b>ЖИНИРИНГ</span></div>');
  // Russian light master in the header; English light master in the footer.
  out = out.replace(/<header\b[\s\S]*?<\/header>/, (header) => header
    .replaceAll('assets/brand/roseen-wordmark.svg','assets/brand/rosin-wordmark.svg')
    .replaceAll('alt="ROSEEN"','alt="РОСИН"')
    .replaceAll('aria-label="ROSEEN — главная"','aria-label="РОСИН — главная"')
    .replaceAll('width="1843.5385"','width="1561.1709"'));
  out = out.replace(/<footer\b[\s\S]*?<\/footer>/, footer => footer.replace(/loading="lazy"/g, 'loading="eager"'));
  // Place the disclosure beside each editorial visual, not only in the footer.
  // Product photos and the approved logo masters are intentionally excluded.
  out = out.replace(/(<img\b[^>]*class="[^"]*(?:hero-image|inner-image|feature-image)[^"]*"[^>]*>)/g,
    '$1<p class="visual-caption">AI-иллюстрация направления · не фотография выполненной работы</p>');
  if (file === 'index.html') {
    out = out.replace(/<section class="numbers">[\s\S]*?<\/section>/,
      '<section class="numbers" aria-label="Принципы сервиса"><div class="container numbers-grid"><div class="number"><strong>Причина.</strong><span>Сначала диагностика</span></div><div class="number"><strong>Решение.</strong><span>Согласованный объём работ</span></div><div class="number"><strong>Результат.</strong><span>Проверка после ремонта</span></div></div></section>');
  }
  out = out.replace(/<nav\b[^>]*class="(?:nav|mobile-nav)"[^>]*>[\s\S]*?<\/nav>/g, nav => {
    if (nav.includes('href="news.html"')) return nav;
    const news = '<a href="news.html">Новости</a>';
    // Keep News among primary links and above the request CTA on mobile,
    // so it is visible without scrolling to the very bottom of the drawer.
    if (nav.includes('class="mobile-nav"') && nav.includes('<a href="contacts.html#request">')) {
      return nav.replace('<a href="contacts.html#request">', news + '<a href="contacts.html#request">');
    }
    if (nav.includes('<a href="faq.html">FAQ</a>')) return nav.replace('<a href="faq.html">FAQ</a>', '<a href="faq.html">FAQ</a>' + news);
    return nav.replace('</nav>', news + '</nav>');
  });
  if (storefront) {
    out = out.replace('</head>', '<link rel="stylesheet" href="store.css?v=graphite-brand-20261003">\n<script type="module" src="store.js"></script>\n</head>');
    out = out.replace(/<nav\b[^>]*class="(?:nav|mobile-nav)"[^>]*>[\s\S]*?<\/nav>/g, nav => {
      if (nav.includes('href="shop.html"')) return nav;
      return nav.replace('</nav>', '<a href="shop.html">Магазин</a><a class="cart-nav" href="cart.html">Корзина <span class="cart-badge" data-cart-count aria-label="товаров">0</span></a><a href="account.html">Кабинет</a></nav>');
    });
  }
  // Keep the current section visible on articles, categories and detail pages,
  // including when JavaScript is disabled. Exact pages retain page semantics.
  const section = /^briefing-/.test(file) ? 'news.html'
    : /^(?:shop-|product-)/.test(file) ? 'shop.html'
    : ['robotics.html','electronics.html','appliances.html','professional.html'].includes(file) ? 'directions.html'
    : ['diagnostika.html','remont.html','servis.html','engineering.html'].includes(file) ? 'services.html'
    : file;
  out = out.replace(/<nav\b[^>]*class="(?:nav|mobile-nav)"[^>]*>[\s\S]*?<\/nav>/g, nav =>
    nav.replace(/<a\b[^>]*href="([^"]+)"[^>]*>/g, (tag, href) => {
      const target = href.split('#')[0];
      const clean = tag.replace(/\saria-current="[^"]*"/g, '');
      const state = target === file ? 'page' : target === section ? 'location' : null;
      return state ? clean.replace(/>$/, ` aria-current="${state}">`) : clean;
    }));
  return out.replace('<body>', `<body data-brand-release="4.0"${storefront ? ' data-storefront="preview"' : ''}>`);
}
export function brandScript(js) {
  return js.replace(/  document\.body\.classList\.add\('brand-ready'\);[\s\S]*?(?=  const current =)/,'');
}
