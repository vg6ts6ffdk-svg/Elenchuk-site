/** Approved brandbook 4.0 -> static output. No client-side logo swapping. */
export function brandPage(html, file) {
  if (!html.includes('site-header')) return html;
  // The source copy stays untouched; every published page gets one shared layer.
  let out = html
    .replace(/<span class="brand-wordmark">ROSEEN<\/span>/g, '<img src="logo-approved.svg" alt="ROSEEN" width="1843.5385" height="200">')
    .replace(/href="style\.css(?:\?[^"]*)?"/g, 'href="style.css"')
    .replace('</head>', '<meta name="theme-color" content="#0F172A">\n<link rel="preconnect" href="https://rsms.me">\n<link rel="stylesheet" href="brand.css">\n</head>');
  out = out.replace(/<link\b(?=[^>]*rel="icon")[^>]*>/g, '<link rel="icon" type="image/svg+xml" href="favicon.svg">');
  out = out.replace(/<img\b(?=[^>]*src="logo-approved\.svg")[^>]*>/g, (tag) => tag
    .replace('src="logo-approved.svg"','src="assets/brand/roseen-wordmark.svg"')
    .replace(/width="[^"]+"/,'width="1843.5385"').replace(/height="[^"]+"/,'height="200"'));
  out = out.replace(/class="([^"]*)"/g, (_, classes) => 'class="' + classes.split(/\s+/).filter(x => x && !['magnetic','parallax-image'].includes(x)).join(' ') + '"');
  out = out.replace(/<div class="eyebrow">\s*<i>\s*<\/i>\s*ROBOTICS\s*[•·]\s*SERVICE\s*[•·]\s*ENGINEERING\s*<\/div>/g,
    '<div class="eyebrow brand-sequence" aria-label="Robotics · Service · Engineering"><span class="brand-token"><b>RO</b>BOTICS</span> <span class="brand-token"><b>SE</b>RVICE</span> <span class="brand-token"><b>EN</b>GINEERING</span></div>');
  out = out.replace(/<footer>[\s\S]*?<\/footer>/, (footer) => footer
    .replaceAll('assets/brand/roseen-wordmark.svg','assets/brand/rosin-wordmark.svg')
    .replaceAll('alt="ROSEEN"','alt="РОСИН"')
    .replaceAll('width="1843.5385"','width="1561.1709"')
    .replace('ROSEEN · Robotics · Service · Engineering','РОСИН · Инженерный сервис'));
  if (file === 'index.html') {
    out = out.replace(/<section class="numbers">[\s\S]*?<\/section>/,
      '<section class="numbers" aria-label="Принципы сервиса"><div class="container numbers-grid"><div class="number"><strong>Причина.</strong><span>Сначала диагностика</span></div><div class="number"><strong>Решение.</strong><span>Согласованный объём работ</span></div><div class="number"><strong>Результат.</strong><span>Проверка после ремонта</span></div></div></section>');
  }
  return out.replace('<body>', '<body data-brand-release="4.0">');
}
export function brandScript(js) {
  return js.replace(/  document\.body\.classList\.add\('brand-ready'\);[\s\S]*?(?=  const current =)/,'');
}
