import { storefrontEnabled, storePageNames, storeMediaFiles } from './storefront/settings.mjs';
export const servicePages = [
  'index.html', 'directions.html', 'services.html', 'robotics.html',
  'electronics.html', 'appliances.html', 'professional.html', 'diagnostika.html',
  'remont.html', 'servis.html', 'engineering.html', 'about.html', 'faq.html',
  'contacts.html', 'request.html', 'robots.html', 'admin.html', '404.html'
];
export const previewEnabled = storefrontEnabled();
export const generatedPages = previewEnabled ? storePageNames() : [];
export const briefingPages = ['news.html', 'briefings.html', 'briefing-2026-09-28.html', 'briefing-2026-09-21.html'];
export const pages = [...servicePages, ...briefingPages, ...generatedPages];
export const generatedFiles = [...generatedPages, 'assets/app.min.js','assets/store.min.js','assets/site.min.css', ...(previewEnabled ? ['store-data.json'] : [])];
// Explicit public files: source, backups, templates and user data stay private.
export const publicFiles = [...pages, 'briefings.css', 'style.css', 'brand.css', 'motion.js', 'motion.css', 'script.js', 'api-config.js',
  'assets/app.min.js','assets/store.min.js','assets/site.min.css','assets/fonts/InterVariable.woff2','assets/fonts/OFL.txt',
  'admin.css', 'admin.js', 'admin-client.mjs', 'admin-catalog.js', 'logo-approved.svg', 'favicon.svg',
  'assets/brand/roseen-wordmark.svg', 'assets/brand/rosin-wordmark.svg',
  'assets/brand/roseen-icon-r.svg', 'assets/brand/roseen-icon-ee.svg',
  'assets/brand/favicon-32.png', 'assets/brand/apple-touch-icon.png',
  'assets/brand/roseen-icon-r-512.png', 'assets/human-robot-connection.webp',
  'robots.txt', 'sitemap.xml', 'CNAME',
  ...(previewEnabled ? ['store.js', 'store-core.js', 'store.css', 'store-data.json', ...storeMediaFiles()] : []),
  ...['robotics','electronics','professional'].flatMap(name =>
    [640,1280].map(size => 'assets/' + name + '-' + size + '.webp'))];
