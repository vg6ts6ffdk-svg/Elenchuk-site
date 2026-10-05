import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { publicFiles, generatedFiles, previewEnabled } from '../public-files.mjs';
import { brandPage, brandScript } from './brand-pages.mjs';
import { renderStoreFiles } from '../storefront/render.mjs';
import { build } from 'esbuild';
import { sitePage } from './site-pages.mjs';
const generated = previewEnabled ? renderStoreFiles() : new Map();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const remote = process.env.ROSEEN_API_BASE || 'https://api.roseen.ru';
const url = new URL(remote);
if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
  throw new Error('ROSEEN_API_BASE must be an HTTPS origin, without credentials, query or path.');
}
for (const file of publicFiles) if (!generatedFiles.includes(file) && !fs.statSync(path.join(root, file)).isFile()) throw new Error(`Missing ${file}`);
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist);
await build({entryPoints:[path.join(root,'scripts/client.mjs')],bundle:true,minify:true,target:['es2020'],format:'iife',outfile:path.join(dist,'assets/app.min.js'),legalComments:'none',plugins:[{name:'api-origin',setup(builder){builder.onLoad({filter:/api-config\.js$/},args=>({contents:fs.readFileSync(args.path,'utf8').replace("'https://api.roseen.ru'",JSON.stringify(url.origin)),loader:'js'}));}}]});
await build({entryPoints:[path.join(root,'store.js')],bundle:true,minify:true,target:['es2020'],format:'iife',outfile:path.join(dist,'assets/store.min.js'),legalComments:'none'});
await build({entryPoints:[path.join(root,'site.css')],bundle:true,minify:true,target:['chrome100','safari15.4'],outfile:path.join(dist,'assets/site.min.css'),external:['./assets/fonts/InterVariable.woff2','./assets/human-robot-connection.webp'],legalComments:'none'});
const hashes = new Map();
for (const file of publicFiles) {
  if (['assets/app.min.js','assets/store.min.js','assets/site.min.css'].includes(file)) {
    let content=fs.readFileSync(path.join(dist,file));
    if(file==='assets/site.min.css') {
      content=Buffer.from(content.toString().replace(/url\([^)]*InterVariable\.woff2[^)]*\)/g,'url(./fonts/InterVariable.woff2)').replace(/url\([^)]*human-robot-connection\.webp[^)]*\)/g,'url(./human-robot-connection.webp)'));
      fs.writeFileSync(path.join(dist,file),content);
    }
    hashes.set(file,createHash('sha256').update(content).digest('hex').slice(0,12));continue;
  }
  let content = generated.has(file) ? Buffer.from(generated.get(file)) : fs.readFileSync(path.join(root, file));
  if (file === 'api-config.js') content = Buffer.from(content.toString().replace("'https://api.roseen.ru'", JSON.stringify(url.origin)));
  if (file === 'script.js') content = Buffer.from(brandScript(content.toString()));
  if (file.endsWith('.html')) content = Buffer.from(sitePage(brandPage(content.toString(),file,{storefront:previewEnabled}),file,{storefront:previewEnabled}));
  fs.mkdirSync(path.dirname(path.join(dist, file)), { recursive: true });
  fs.writeFileSync(path.join(dist, file), content);
  hashes.set(file, createHash('sha256').update(content).digest('hex').slice(0, 12));
}
for (const file of publicFiles.filter(file => file.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(dist, file), 'utf8').replace(/(src|href)="([^"?#]+\.(?:js|css|svg|png|jpg|webp))"/g,
    (match, attr, name) => hashes.has(name.replace(/^\//,'')) ? `${attr}="${name}?v=${hashes.get(name.replace(/^\//,''))}"` : match);
  fs.writeFileSync(path.join(dist, file), html);
}
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
console.log(`Built ${publicFiles.length} public files in dist. Brandbook: 5.0 (owner refinements). API: ${url.origin}. Storefront: ${previewEnabled ? 'preview / checkout closed' : 'disabled'}`);
