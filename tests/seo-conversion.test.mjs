import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { businessSchema, settings, structuredData, sitePage } from '../scripts/site-pages.mjs';
import { brandPage } from '../scripts/brand-pages.mjs';
import { analyticsPolicy } from '../scripts/analytics-policy.mjs';
const source=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
test('missing business facts never become invented contact/location claims',()=>{
  const data=businessSchema();assert.equal(data['@type'],'Organization');
  for(const key of ['address','telephone','geo','openingHoursSpecification']) assert.equal(data[key],undefined);
  const verified={...settings,telephone:'+12025550123',address:{streetAddress:'TEST ONLY',addressLocality:'Test city',addressCountry:'US'},geo:{latitude:1,longitude:2},openingHoursSpecification:[{dayOfWeek:['Monday'],opens:'09:00',closes:'18:00'}]};
  assert.equal(businessSchema(verified)['@type'],'LocalBusiness');
  assert.throws(()=>businessSchema({...verified,geo:{latitude:200,longitude:0}}));
  assert.throws(()=>businessSchema({...settings,address:{addressLocality:'test'}}));
});
test('all four services link to the same provider; full FAQ matches visible answers',()=>{
  const graph=structuredData(source('services.html'),'services.html')['@graph'];
  assert.equal(graph.filter(n=>n['@type']==='Service').length,4);
  assert.ok(graph.filter(n=>n['@type']==='Service').every(n=>n.provider['@id']==='https://roseen.ru/#business'));
  const html=source('faq.html'),faq=structuredData(html,'faq.html')['@graph'].find(n=>n['@type']==='FAQPage');
  assert.equal(faq.mainEntity.length,[...html.matchAll(/<details class="faq/g)].length);
  assert.ok(faq.mainEntity.every(q=>q.name&&q.acceptedAnswer.text));
  assert.equal(structuredData(source('index.html'),'index.html')['@graph'].some(n=>n['@type']==='FAQPage'),false);
});
test('public pages have compact menus, correct bundles, breadcrumbs and private forms',()=>{
  const html=sitePage(brandPage(source('contacts.html'),'contacts.html',{storefront:true}),'contacts.html',{storefront:true});
  const nav=html.match(/<nav class="nav"[^>]*>([\s\S]*?)<\/nav>/)[1];
  assert.equal((nav.match(/<a /g)||[]).length,5);assert.doesNotMatch(nav,/shop.html|cart.html/);
  assert.match(html,/footer-nav[\s\S]*?href="shop.html"/);
  assert.match(html,/action="https:\/\/api.roseen.ru\/api\/requests"/);
  assert.match(html,/name="website"/);assert.match(html,/class="form reveal delay ym-hide-content"/);
  assert.match(html,/id="file-help"/);assert.match(html,/aria-label="Хлебные крошки"/);
  assert.match(html,/assets\/app.min.js/);assert.doesNotMatch(html,/src="(?:script|motion|store|api-config)\.js/);
  assert.match(html,/assets\/site.min.css/);assert.doesNotMatch(html,/href="(?:style|brand|motion|store)\.css/);
  assert.doesNotMatch(html,/assets\/store.min.js/);
  const home=sitePage(brandPage(source('index.html'),'index.html'),'index.html');
  assert.match(home,/imagesrcset=/);assert.match(home,/href="faq.html">Все вопросы/);
  assert.match(home,/AI-иллюстрация: уборочный робот со снятыми панелями/);
  assert.doesNotMatch(home,/Выполненные работы/);
  assert.throws(()=>sitePage(source('index.html'),'index.html',{config:{...settings,cases:[{title:'unverified'}]}}));
});
function analytics(consent='granted',config={metrikaId:123,ga4Id:'G-TEST',webvisor:true}) {
  const handlers={},scripts=[],items=[];
  const element=()=>({children:[],setAttribute(){},append(...children){this.children.push(...children)},addEventListener(){},remove(){},focus(){},querySelector(){return element()}});
  const sandbox={location:{hostname:'roseen.ru',origin:'https://roseen.ru',pathname:'/contacts.html',href:'https://roseen.ru/contacts.html?contact=PRIVATE#PRIVATE'},document:{referrer:'https://example.test/search?secret=PRIVATE',head:{append(el){scripts.push(el.src)}},body:element(),createElement:element,querySelector(){return element()},addEventListener(name,fn){handlers[name]=fn}},localStorage:{getItem(){return consent},setItem(){}},URL,Date,Number,console};
  sandbox.window=sandbox;
  const code=source('analytics.js').replace(/^import[^\n]*\n/,'const configured='+JSON.stringify(config)+';\n');
  vm.runInNewContext(code,sandbox);return {sandbox,scripts,handlers,items};
}
test('analytics is off without IDs or consent; permitted goals contain no PII',()=>{
  assert.equal(analytics('denied').scripts.length,0);
  assert.equal(analytics('granted',{metrikaId:null,ga4Id:null}).scripts.length,0);
  const {sandbox,scripts,handlers}=analytics();assert.equal(scripts.length,2);
  sandbox.ROSEEN_TRACK('request_sent',{form_id:'request-form',contact:'PRIVATE',problem:'PRIVATE',id:123456});
  handlers.click({target:{closest(){return {getAttribute(){return 'tel:+12025550123'}}}}});
  const calls=JSON.stringify([...sandbox.ym.a,...sandbox.dataLayer]);
  assert.match(calls,/generate_lead/);assert.match(calls,/phone_click/);assert.doesNotMatch(calls,/PRIVATE|12025550123|123456/);
  assert.match(calls,/https:\/\/roseen.ru\/contacts.html/);
});
test('provider CSP remains restrictive and only expands when IDs are supplied',()=>{
  assert.deepEqual(analyticsPolicy(settings.analytics).scriptSrc,["'self'"]);
  const policy=analyticsPolicy({metrikaId:123,ga4Id:'G-TEST'});
  assert.ok(policy.scriptSrc.includes('https://mc.yandex.ru'));
  assert.ok(policy.scriptSrc.includes('https://www.googletagmanager.com'));
  assert.doesNotMatch(JSON.stringify(policy),/unsafe-inline|unsafe-eval/);
});
