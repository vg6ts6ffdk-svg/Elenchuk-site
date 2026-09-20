import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { pages } from '../public-files.mjs';
const root=path.resolve('dist');
const output=path.resolve('qa/brandbook'); fs.mkdirSync(output,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){ res.writeHead(404);res.end();return; }
 res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
 res.setHeader('Content-Security-Policy',"default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self' https://api.roseen.ru;img-src 'self' data:;object-src 'none';script-src 'self';style-src 'self' https: 'unsafe-inline';connect-src 'self' https://api.roseen.ru");
 fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(4173,'127.0.0.1',r));
const base=process.env.BRAND_QA_URL||'http://127.0.0.1:4173';
const report={base,checked:[],failures:[],forms:'not run',menu:'not run'};
const publicPages=pages.filter(p=>!['request.html','robots.html','admin.html'].includes(p));
async function inspect(browser,width,file,engine){
 const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1});
 const page=await context.newPage(); const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 // A layout test must never create a real service request.
 await page.route('**/api/requests',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"QA: no real requests"}'}));
 try {
  const response=await page.goto(base+'/'+file,{waitUntil:'domcontentloaded'}); assert.equal(response.status(),200);
  await page.evaluate(()=>Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,5000))]));
  await page.waitForTimeout(800);
  await page.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=700){scrollTo(0,y);await new Promise(r=>setTimeout(r,30));}scrollTo(0,0);});
  await page.waitForTimeout(250);
  const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,bg:getComputedStyle(document.body).backgroundColor,logo:document.querySelector('.brand img')?.getBoundingClientRect().toJSON(),broken:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.getAttribute('src')),inter:[...document.fonts].some(f=>f.family.replaceAll('"','')==='Inter'&&f.status==='loaded')}));
  assert.ok(metrics.scroll<=metrics.width+1,`overflow ${metrics.scroll}/${metrics.width}`);
  assert.equal(metrics.broken.length,0,`broken images ${metrics.broken.join(',')}`);
  assert.equal(metrics.bg,'rgb(15, 23, 42)');
  assert.ok(metrics.logo.width>130&&metrics.logo.width<=220,'brandbook header size');
  assert.equal(errors.length,0,errors.join('; '));
  if(file==='index.html') {
   const prefixes=await page.locator('.brand-token b').allTextContents(); assert.deepEqual(prefixes,['RO','SE','EN']);
  }
  await page.screenshot({path:path.join(output,`${engine}-${width}-${file.replace('.html','')}.png`),fullPage:true});
  report.checked.push({engine,width,file,...metrics});
 } catch(e){ report.failures.push({engine,width,file,error:e.message}); await page.screenshot({path:path.join(output,`FAIL-${engine}-${width}-${file}.png`),fullPage:true}).catch(()=>{}); }
 await context.close();
}
let browser;
try {
 browser=await chromium.launch();
 for(const width of [320,390,768,1440]) for(const file of publicPages) await inspect(browser,width,file,'chromium');
 const context=await browser.newContext({viewport:{width:390,height:844}}); const page=await context.newPage();
 await page.goto(base+'/index.html'); await page.waitForTimeout(850);
 await page.locator('.menu').click(); await page.waitForTimeout(100);
 assert.equal(await page.locator('.menu').getAttribute('aria-expanded'),'true');
 assert.ok(await page.locator('.mobile-nav').isVisible());
 await page.keyboard.press('Escape'); await page.waitForTimeout(100);
 assert.equal(await page.locator('.menu').getAttribute('aria-expanded'),'false');
 assert.equal(await page.evaluate(()=>document.activeElement.matches('.menu')),true);
 await page.locator('.menu').click(); await page.setViewportSize({width:1440,height:900}); await page.waitForTimeout(150);
 assert.equal(await page.evaluate(()=>document.body.classList.contains('menu-open')),false); report.menu='PASS: open, Escape/focus restoration, desktop resize';
 let count=0; let code=503;
 await page.route('**/api/requests',async r=>{count++;await r.fulfill({status:code,contentType:'application/json',body:code===200?'{"id":99001}':'{"error":"QA: сервис временно недоступен"}'});});
 await page.locator('#request-form').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
 await page.locator('#request-form [type=submit]').click(); assert.equal(count,0,'invalid form should not send');
 await page.locator('#equipment_type').selectOption({label:'Робототехника'}); await page.locator('#problem').fill('QA — пример, не реальная заявка'); await page.locator('#contact').fill('qa@example.invalid');
 await page.locator('#request-form [type=submit]').click(); await page.waitForFunction(()=>document.querySelector('.form-status').textContent.includes('QA:'));
 assert.equal(await page.locator('#problem').inputValue(),'QA — пример, не реальная заявка');
 code=200;await page.locator('#request-form [type=submit]').click();await page.waitForFunction(()=>document.querySelector('.form-status').textContent.includes('99001'));
 assert.equal(await page.locator('#problem').inputValue(),'');report.forms='PASS: required fields, mocked 503 preserves input, mocked success confirmation and reset. No real request sent.';
 await context.close();
 const reduced=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const rp=await reduced.newPage();await rp.goto(base+'/index.html');
 assert.equal(await rp.locator('.brand-token').first().evaluate(el=>getComputedStyle(el).animationName),'none');await reduced.close();
 const nojs=await browser.newContext({viewport:{width:320,height:844},javaScriptEnabled:false});const np=await nojs.newPage();await np.goto(base+'/index.html');assert.ok(await np.locator('h1').isVisible());assert.ok(await np.locator('.brand img').isVisible());await np.locator('.menu').click();assert.ok(await np.locator('.mobile-nav').isVisible());await nojs.close();
 await browser.close();browser=await webkit.launch();
 for(const file of ['index.html','contacts.html','robotics.html']) await inspect(browser,390,file,'webkit');
} catch(e){report.failures.push({suite:'interactions',error:e.stack});}
finally { if(browser) await browser.close(); server.close(); fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)); }
console.log(JSON.stringify({layouts:report.checked.length,failures:report.failures,forms:report.forms,menu:report.menu},null,2));
if(report.failures.length) process.exitCode=1;
