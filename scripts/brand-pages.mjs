/** Approved brandbook 4.0 -> static output. No client-side logo swapping. */
export function brandPage(html, file, { storefront = false } = {}) {
  if (!html.includes('site-header')) return html;
  if (/class="brand-wordmark"/.test(html)) throw new Error('Rejected text logo in ' + file);
  // Graphic source masters are preserved; build adds shared presentation only.
  let out = html
    .replace(/href="style\.css(?:\?[^"]*)?"/g, 'href="style.css"')
    .replace('</head>', '<meta name="theme-color" content="#0F172A">\n<link rel="preconnect" href="https://rsms.me">\n<link rel="stylesheet" href="brand.css">\n<link rel="stylesheet" href="motion.css">\n<script src="motion.js" defer></script>\n</head>');
  out = out.replace(/<link\b(?=[^>]*rel="icon")[^>]*>/g, '<link rel="icon" type="image/svg+xml" href="favicon.svg">');
  out = out.replace(/<img\b(?=[^>]*src="logo-approved\.svg")[^>]*>/g, (tag) => tag
    .replace('src="logo-approved.svg"','src="assets/brand/roseen-wordmark.svg"')
    .replace(/width="[^"]+"/,'width="1843.5385"').replace(/height="[^"]+"/,'height="200"'));
  out = out.replace(/class="([^"]*)"/g, (_, classes) => 'class="' + classes.split(/\s+/).filter(x => x && !['magnetic','parallax-image'].includes(x)).join(' ') + '"');
  out = out.replace(/<div class="eyebrow">\s*<i>\s*<\/i>\s*ROBOTICS\s*[•·]\s*SERVICE\s*[•·]\s*ENGINEERING\s*<\/div>/g,
    '<div class="eyebrow brand-sequence" aria-label="Robotics · Service · Engineering"><span class="brand-token"><b>RO</b>BOTICS</span> <span class="brand-token"><b>SE</b>RVICE</span> <span class="brand-token"><b>EN</b>GINEERING</span></div>');
  // Russian light master in the header; English light master in the footer.
  out = out.replace(/<header\b[\s\S]*?<\/header>/, (header) => header
    .replaceAll('assets/brand/roseen-wordmark.svg','assets/brand/rosin-wordmark.svg')
    .replaceAll('alt="ROSEEN"','alt="РОСИН"')
    .replaceAll('aria-label="ROSEEN — главная"','aria-label="РОСИН — главная"')
    .replaceAll('width="1843.5385"','width="1561.1709"'));
  out = out.replace(/<footer\b[\s\S]*?<\/footer>/, footer => footer.replace(/loading="lazy"/g, 'loading="eager"'));
  if (file === 'index.html') {
    out = out.replace(/<section class="numbers">[\s\S]*?<\/section>/,
      '<section class="numbers" aria-label="Принципы сервиса"><div class="container numbers-grid"><div class="number"><strong>Причина.</strong><span>Сначала диагностика</span></div><div class="number"><strong>Решение.</strong><span>Согласованный объём работ</span></div><div class="number"><strong>Результат.</strong><span>Проверка после ремонта</span></div></div></section>');
  }
  if (storefront) {
    out = out.replace('</head>', '<link rel="stylesheet" href="store.css">\n<script type="module" src="store.js"></script>\n</head>');
    out = out.replace(/<nav\b[^>]*class="(?:nav|mobile-nav)"[^>]*>[\s\S]*?<\/nav>/g, nav => {
      if (nav.includes('href="shop.html"')) return nav;
      return nav.replace('</nav>', '<a href="shop.html">Магазин</a><a class="cart-nav" href="cart.html">Корзина <span class="cart-badge" data-cart-count aria-label="товаров">0</span></a></nav>');
    });
  }
  return out.replace('<body>', `<body data-brand-release="4.0"${storefront ? ' data-storefront="preview"' : ''}>`);
}
export function brandScript(js) {
  return js.replace(/  document\.body\.classList\.add\('brand-ready'\);[\s\S]*?(?=  const current =)/,'');
}
