import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const target = path.resolve(process.argv[2] || '.');
const requiredPages = [
  'index.html',
  'services.html',
  'robotics.html',
  'electronics.html',
  'appliances.html',
  'diagnostika.html',
  'remont.html',
  'servis.html',
  'engineering.html',
  'about.html',
  'contacts.html',
  'admin.html'
];
const canonicalNav = [
  ['index.html', 'Главная'],
  ['services.html', 'Услуги'],
  ['robotics.html', 'Робототехника'],
  ['electronics.html', 'Электроника'],
  ['about.html', 'О компании'],
  ['contacts.html', 'Контакты']
];
const publicPages = requiredPages.filter(page => page !== 'admin.html');
const errors = [];

const exists = async file => {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
};

for (const page of requiredPages) {
  if (!(await exists(path.join(target, page)))) errors.push(`Missing required page: ${page}`);
}

const entries = await readdir(target, { withFileTypes: true });
const htmlFiles = entries
  .filter(entry => entry.isFile() && entry.name.endsWith('.html') && entry.name !== 'page-template.html')
  .map(entry => entry.name);

for (const file of htmlFiles) {
  const fullPath = path.join(target, file);
  const html = await readFile(fullPath, 'utf8');
  const refRegex = /\b(?:href|src)=["']([^"']+)["']/gi;
  let match;
  while ((match = refRegex.exec(html))) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('//') || /^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(raw)) continue;
    const clean = raw.split('#')[0].split('?')[0];
    if (!clean) continue;
    const resolved = path.resolve(path.dirname(fullPath), clean);
    if (!(await exists(resolved))) errors.push(`${file}: missing local reference ${raw}`);
  }

  if (publicPages.includes(file)) {
    for (const [href, label] of canonicalNav) {
      const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const navPattern = new RegExp(`<a[^>]+href=["']${escapedHref}["'][^>]*>\\s*${escapedLabel}\\s*<\\/a>`, 'i');
      if (!navPattern.test(html)) errors.push(`${file}: canonical navigation item missing: ${label} -> ${href}`);
    }
  }
}

const scriptPath = path.join(target, 'script.js');
if (await exists(scriptPath)) {
  const script = await readFile(scriptPath, 'utf8');
  const forbidden = [
    ['assetMap', 'runtime image-path rewriting'],
    ['nav.innerHTML', 'runtime desktop-menu reconstruction'],
    ['roseen-mobile-menu', 'duplicate runtime mobile menu'],
    ['data-roseen-theme', 'runtime theme stylesheet injection']
  ];
  for (const [needle, reason] of forbidden) {
    if (script.includes(needle)) errors.push(`script.js still contains ${reason} (${needle})`);
  }
}

if (await exists(path.join(target, 'CNAME'))) {
  const cname = (await readFile(path.join(target, 'CNAME'), 'utf8')).trim();
  if (cname !== 'roseen.ru') errors.push(`Unexpected CNAME: ${cname || '(empty)'}`);
}

if (errors.length) {
  console.error('\nSite validation failed:\n');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Site validation passed for ${target}: ${htmlFiles.length} HTML pages checked.`);
