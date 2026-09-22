import { storefrontEnabled, storePageNames, storeMediaFiles } from './storefront/settings.mjs';
export const servicePages = [
  'index.html', 'directions.html', 'services.html', 'robotics.html',
  'electronics.html', 'appliances.html', 'professional.html', 'diagnostika.html',
  'remont.html', 'servis.html', 'engineering.html', 'about.html', 'faq.html',
  'contacts.html', 'request.html', 'robots.html', 'admin.html', '404.html'
];
export const previewEnabled = storefrontEnabled();
export const generatedPages = previewEnabled ? storePageNames() : [];
export const pages = [...servicePages, ...generatedPages];
export const generatedFiles = [...generatedPages, ...(previewEnabled ? ['store-data.json'] : [])];
// Explicit public files: source, backups, templates and user data stay private.
export const publicFiles = [...pages, 'style.css', 'brand.css', 'motion.js', 'motion.css', 'script.js', 'api-config.js',
  'admin.css', 'admin.js', 'logo-approved.svg', 'favicon.svg',
  'assets/brand/roseen-wordmark.svg', 'assets/brand/rosin-wordmark.svg',
  'robots.txt', 'sitemap.xml', 'CNAME',
  ...(previewEnabled ? ['store.js', 'store-core.js', 'store.css', 'store-data.json', ...storeMediaFiles()] : []),
  'prototypes/cc1-exploded-scroll.html', 'prototypes/cc1-exploded-scroll.js',
  'prototypes/cc1-exploded-scroll-v2.html', 'prototypes/cc1-exploded-scroll-v2.js',
  'prototypes/cc1-showcase-v3.html', 'prototypes/cc1-showcase-v3.js',
  ...['robotics','electronics','appliances','professional'].flatMap(name =>
    [640,1280].map(size => 'assets/' + name + '-' + size + '.webp'))];
