import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { brandPage, brandScript } from '../scripts/brand-pages.mjs';
const fixture = `<!doctype html><html><head><link rel="icon" href="logo-approved.svg"><link rel="stylesheet" href="style.css"></head><body><header class="site-header"><a class="brand" href="index.html"><img src="logo-approved.svg" alt="ROSEEN" width="1426" height="282"></a></header><main><div class="eyebrow"><i></i> ROBOTICS • SERVICE • ENGINEERING</div><form id="request-form" method="post" action="/api/requests"><input name="contact"></form><img class="hero-image parallax-image"><a class="btn magnetic">CTA</a></main><footer><img src="logo-approved.svg" alt="ROSEEN" width="1426" height="282"><div>ROSEEN · Robotics · Service · Engineering</div></footer></body></html>`;
test('static brand layer and independent icon appear once', () => {
 const out=brandPage(fixture,'index.html');
 assert.equal((out.match(/href="brand\.css(?:\?[^"\s]+)?"/g)||[]).length,1);
 assert.match(out,/href="favicon.svg"/); assert.doesNotMatch(out,/src="logo-approved.svg"/);
 assert.match(out,/assets\/brand\/roseen-wordmark.svg/); assert.match(out,/assets\/brand\/rosin-wordmark.svg/);
});
test('Russian descriptor uses РО / С / ИН in DOM order without dynamic innerHTML', () => {
 const out=brandPage(fixture,'index.html');
 assert.ok(out.indexOf('<b>РО</b>')<out.indexOf('<b>С</b>'));
 assert.ok(out.indexOf('<b>С</b>')<out.indexOf('<b>ИН</b>'));
 assert.doesNotMatch(out,/CeRVICE|InGINEERING|ROSIN/);
});
test('form contract is untouched and decorative movement is removed', () => {
 const out=brandPage(fixture,'index.html');
 assert.match(out,/<form id="request-form" method="post" action="\/api\/requests"><input name="contact"><\/form>/);
 assert.doesNotMatch(out,/class="[^"]*(?:magnetic|parallax-image)/);
});
test('redirect and administration files without site shell remain untouched', () => {
 const html='<html><head><meta http-equiv="refresh" content="0;url=robotics.html"></head></html>';
 assert.equal(brandPage(html,'robots.html'),html);
});
test('old dynamic descriptor block is removed without changing the rest of script', () => {
 const js="prefix\n  document.body.classList.add('brand-ready');\n  const brandEyebrow = 1;\n  const current = 'index.html';\nsuffix";
 assert.equal(brandScript(js),"prefix\n  const current = 'index.html';\nsuffix");
});
test('artwork is outlined; both E letters contain exactly three fixed bars', () => {
 const en=fs.readFileSync(new URL('../assets/brand/roseen-wordmark.svg',import.meta.url),'utf8');
 const ru=fs.readFileSync(new URL('../assets/brand/rosin-wordmark.svg',import.meta.url),'utf8');
 for(const svg of [en,ru]) { assert.doesNotMatch(svg,/<(?:text|image)\b/); assert.doesNotMatch(svg,/#0fa798/i); }
 assert.match(en,/viewBox="100 100 1843.5385 200"/);
 assert.equal((en.match(/<rect /g)||[]).length,6);
 assert.match(ru,/id="letter-I"/);
});
test('brandbook palette, heading sizes and reduced motion rules exist', () => {
 const css=fs.readFileSync(new URL('../brand.css',import.meta.url),'utf8');
 for(const value of ['#0F172A','#3B82F6','#FFFFFF','font-size:56px','font-size:36px','prefers-reduced-motion:reduce']) assert.ok(css.includes(value));
 assert.doesNotMatch(css,/overflow-x:\s*(?:hidden|clip)/);
});
test('rejected typed logos fail the build instead of surviving as fallback', () => {
 const html=fixture.replace('<img src="logo-approved.svg" alt="ROSEEN" width="1426" height="282">','<span class="brand-wordmark">ROSEEN</span>');
 assert.throws(()=>brandPage(html,'index.html'),/Rejected text logo/);
});
test('navigation distinguishes the current page from its enclosing section without JS', () => {
 const source = fs.readFileSync(new URL('../news.html',import.meta.url),'utf8');
 const article = brandPage(source,'briefing-2026-09-28.html',{storefront:true});
 assert.match(article, /href="news.html" aria-current="location"/);
 assert.doesNotMatch(article, /href="news.html" aria-current="page"/);
 const archive = brandPage(source,'news.html',{storefront:true});
 assert.match(archive, /href="news.html" aria-current="page"/);
 const category = brandPage(source,'shop-belts.html',{storefront:true});
 assert.match(category, /href="shop.html" aria-current="location"/);
 assert.doesNotMatch(category, /href="news.html" aria-current=/);
});
