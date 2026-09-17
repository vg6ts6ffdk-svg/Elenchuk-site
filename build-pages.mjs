import { copyFile, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const STYLE_VERSION = '18';
const SCRIPT_VERSION = '12';
const LOGO_VERSION = '13';
const API_BASE = process.env.ROSEEN_API_BASE || 'https://api.roseen.ru';

const desktopNav = '<nav class="nav"><a href="index.html">Главная</a><a href="services.html">Услуги</a><a href="robotics.html">Робототехника</a><a href="electronics.html">Электроника</a><a href="about.html">О компании</a><a href="contacts.html">Контакты</a></nav>';
const mobileNav = '<nav class="mobile-nav"><a href="index.html">Главная</a><a href="services.html">Услуги</a><a href="robotics.html">Робототехника</a><a href="electronics.html">Электроника</a><a href="appliances.html">Бытовая техника</a><a href="engineering.html">Инженерия</a><a href="about.html">О компании</a><a href="contacts.html">Контакты</a><a href="contacts.html#request">Оставить заявку ↗</a></nav>';

const exists = async file => {
  try {
    await readFile(file);
    return true;
  } catch {
    return false;
  }
};

await rm(DIST, { recursive: true, force: true });
await mkdir(path.join(DIST, 'assets'), { recursive: true });

const cssParts = ['style.css', 'theme.css', 'brand.css', 'mobile-fix.css'];
const css = (await Promise.all(cssParts.map(file => readFile(path.join(ROOT, file), 'utf8')))).join('\n\n');
await writeFile(path.join(DIST, 'style.css'), css);

const rootEntries = await readdir(ROOT, { withFileTypes: true });
const publicImageExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.ico']);
for (const entry of rootEntries) {
  if (!entry.isFile()) continue;
  if (publicImageExts.has(path.extname(entry.name).toLowerCase())) {
    await copyFile(path.join(ROOT, entry.name), path.join(DIST, entry.name));
  }
}

if (await exists(path.join(ROOT, 'assets', 'logo.svg'))) {
  await cp(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), { recursive: true, force: true });
}

const aliases = [
  ['robots.jpg', 'assets/robot-lab.png'],
  ['electronics.jpg', 'assets/electronics-lab.png'],
  ['home-appliances.jpg', 'assets/appliance-lab.png'],
  ['robot-cta.jpg', 'assets/robot-cta.jpg'],
  ['logo.svg', 'assets/logo.svg']
];
for (const [from, to] of aliases) {
  await copyFile(path.join(ROOT, from), path.join(DIST, to));
}

for (const file of ['script.js', 'scroll.js', 'robots.txt', 'sitemap.xml', 'CNAME']) {
  if (await exists(path.join(ROOT, file))) {
    await copyFile(path.join(ROOT, file), path.join(DIST, file));
  }
}

const apiBaseJson = JSON.stringify(API_BASE).replace(/</g, '\\u003c');
for (const entry of rootEntries) {
  if (!entry.isFile() || !entry.name.endsWith('.html') || entry.name === 'page-template.html') continue;

  let html = await readFile(path.join(ROOT, entry.name), 'utf8');

  html = html.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["'][^"']*(?:style|theme|brand|mobile-fix)\.css(?:\?[^"']*)?["'][^>]*>\s*/gi, '');
  html = html.replace(/<script\b[^>]*src=["'](?:\.\/)?script\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi, '');
  html = html.replace(/<script>\s*window\.ROSEEN_API_BASE=.*?<\/script>\s*/gis, '');
  html = html.replace(/<nav class=["']nav["']>[\s\S]*?<\/nav>/i, desktopNav);
  html = html.replace(/<nav class=["']mobile-nav["']>[\s\S]*?<\/nav>/i, mobileNav);
  html = html.replace(/assets\/logo\.svg(?:\?v=\d+)?/g, `assets/logo.svg?v=${LOGO_VERSION}`);
  html = html.replace('</head>', `<link rel="stylesheet" href="style.css?v=${STYLE_VERSION}"></head>`);
  html = html.replace('</body>', `<script>window.ROSEEN_API_BASE=${apiBaseJson};</script><script src="script.js?v=${SCRIPT_VERSION}"></script></body>`);

  await writeFile(path.join(DIST, entry.name), html);
}

console.log(`Built ${DIST} with API ${API_BASE}`);
