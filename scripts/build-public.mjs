import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { publicFiles } from '../public-files.mjs';
import { brandPage, brandScript } from './brand-pages.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const remote = process.env.ROSEEN_API_BASE || 'https://api.roseen.ru';
const url = new URL(remote);
if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
  throw new Error('ROSEEN_API_BASE must be an HTTPS origin, without credentials, query or path.');
}
for (const file of publicFiles) if (!fs.statSync(path.join(root, file)).isFile()) throw new Error(`Missing ${file}`);
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist);
const hashes = new Map();
for (const file of publicFiles) {
  let content = fs.readFileSync(path.join(root, file));
  if (file === 'api-config.js') content = Buffer.from(content.toString().replace("'https://api.roseen.ru'", JSON.stringify(url.origin)));
  if (file === 'script.js') content = Buffer.from(brandScript(content.toString()));
  if (file.endsWith('.html')) content = Buffer.from(brandPage(content.toString(),file));
  fs.mkdirSync(path.dirname(path.join(dist, file)), { recursive: true });
  fs.writeFileSync(path.join(dist, file), content);
  hashes.set(file, createHash('sha256').update(content).digest('hex').slice(0, 12));
}
for (const file of publicFiles.filter(file => file.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(dist, file), 'utf8').replace(/(src|href)="([^"?#]+\.(?:js|css|svg|jpg|webp))"/g,
    (match, attr, name) => hashes.has(name) ? `${attr}="${name}?v=${hashes.get(name)}"` : match);
  fs.writeFileSync(path.join(dist, file), html);
}
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
console.log(`Built ${publicFiles.length} public files in dist. Brandbook: 4.0. API: ${url.origin}`);
