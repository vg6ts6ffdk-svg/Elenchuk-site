export const pages = [
  'index.html', 'directions.html', 'services.html', 'robotics.html',
  'electronics.html', 'appliances.html', 'professional.html', 'diagnostika.html',
  'remont.html', 'servis.html', 'engineering.html', 'about.html', 'faq.html',
  'contacts.html', 'request.html', 'robots.html', 'admin.html', '404.html'
];
// Explicit public files: source, backups, templates and user data stay private.
export const publicFiles = [...pages, 'style.css', 'brand.css', 'script.js', 'api-config.js',
  'admin.css', 'admin.js', 'logo-approved.svg', 'favicon.svg',
  'assets/brand/roseen-wordmark.svg', 'assets/brand/rosin-wordmark.svg',
  'robots.txt', 'sitemap.xml', 'CNAME',
  ...['robotics','electronics','appliances','professional'].flatMap(name =>
    [640,1280].map(size => 'assets/' + name + '-' + size + '.webp'))];
