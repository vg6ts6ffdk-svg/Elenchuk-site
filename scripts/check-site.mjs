import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { pages, publicFiles, previewEnabled } from '../public-files.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2] ? path.resolve(root, process.argv[2]) : root;
const errors = [];
const virtual = target === root && previewEnabled ? (await import('../storefront/render.mjs')).renderStoreFiles() : new Map();
const exists = name => virtual.has(name) || fs.existsSync(path.join(target,name));
const docs = new Map(pages.map(file => [file, virtual.has(file) ? virtual.get(file) : fs.readFileSync(path.join(target,file),'utf8')]));
const ids = new Map([...docs].map(([file,html]) => [file,new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]))]));
let references = 0;
for(const [file,html] of docs) {
  if (/\{\{[^}]+\}\}/.test(html)) errors.push(file + ': template placeholder');
  const allIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  if(new Set(allIds).size !== allIds.length) errors.push(file + ': duplicate IDs');
  for(const m of html.matchAll(/\baria-describedby="([^"]+)"/g)) for(const id of m[1].split(/\s+/)) if(!ids.get(file).has(id)) errors.push(file+': missing accessible description #'+id);
  for(const m of html.matchAll(/<img\b[^>]*>/g)) if(!/\balt="[^"]*"/.test(m[0])) errors.push(file+': image missing alt');
  for(const match of html.matchAll(/\b(?:src|href|action)="([^"]+)"/g)) {
    const value = match[1];
    if(match[0].startsWith('action=') && value === '/api/requests') continue;
    if (/^(https?:|mailto:|tel:|data:)/.test(value)) continue;
    const [pathname,fragment] = value.split('#');
    const name = pathname === '/' ? 'index.html' : pathname.split('?')[0].replace(/^\//,'') || file;
    references++;
    if(!publicFiles.includes(name) || !exists(name)) errors.push(file + ': missing public file ' + name);
    else if(fragment && docs.has(name) && !ids.get(name).has(fragment)) errors.push(file + ': missing #' + fragment + ' in ' + name);
  }
  for(const match of html.matchAll(/\bsrcset="([^"]+)"/g)) {
    for(const item of match[1].split(',')) {
      const name=item.trim().split(/\s+/)[0].split('?')[0]; references++;
      if(!publicFiles.includes(name) || !exists(name)) errors.push(file + ': missing srcset ' + name);
    }
  }
  if(/<form\b/.test(html)) {
    const bundled=/<script[^>]+src="\/?assets\/app\.min\.js(?:\?[^"]*)?"[^>]*>/.test(html);
    if(!bundled && !/<script[^>]+src="api-config\.js(?:\?[^"]*)?"[^>]*>/.test(html)) errors.push(file + ': API configuration missing');
    if(!bundled && html.indexOf('api-config.js') > html.indexOf(file === 'admin.html' ? 'admin.js' : 'script.js')) errors.push(file + ': wrong config script order');
    for(const match of html.matchAll(/<label\s+for="([^"]+)"/g)) if(!ids.get(file).has(match[1])) errors.push(file + ': label target missing');
    if(file!=='admin.html' && !/<form[^>]*method="post"/.test(html) && !/<form[^>]*data-catalog-search[^>]*method="get"/.test(html)) errors.push(file + ': form must POST');
  }
  if(/\bon(?:click|submit|error)\s*=/.test(html)) errors.push(file + ': inline JS handler');
  if(/<script(?![^>]*(?:src=|type="application\/ld\+json"))[^>]*>\s*[^<\s]/.test(html)) errors.push(file + ': inline executable script');
  for(const m of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try { const data=JSON.parse(m[1]); if(data['@context']!=='https://schema.org') errors.push(file+': incorrect Schema.org context'); }
    catch { errors.push(file+': invalid JSON-LD'); }
  }
}
for(const file of ['script.js','motion.js','api-config.js','admin.js', ...(previewEnabled?['store.js','store-core.js']:[]), ...(target===root?['server.js']:[])]) {
  const check=spawnSync(process.execPath,['--check',path.join(target,file)],{encoding:'utf8'});
  if(check.status!==0) errors.push(check.stderr);
}
if(target!==root) {
  const css=fs.readFileSync(path.join(target,'assets/site.min.css'),'utf8');
  for(const m of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) if(!/^(?:https?:|data:)/.test(m[1])) {
    const file=path.resolve(target,'assets',m[1]);
    if(!file.startsWith(target+path.sep)||!fs.existsSync(file)) errors.push('Bundled CSS references missing asset: '+m[1]);
  }
}
if(target!==root) for(const forbidden of ['server.js','page-template.html','.env','.env.example','package.json','data','style.css.bak']) {
  if(fs.existsSync(path.join(target,forbidden))) errors.push('Private file published: '+forbidden);
}
if(errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('PASS: '+pages.length+' pages; '+references+' local references; form configuration; JavaScript syntax; public file allowlist.');
