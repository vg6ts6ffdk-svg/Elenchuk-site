import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'roseen-api-security-'));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lN8AAAAASUVORK5CYII=','base64');
let child,base;
async function start(){
  const listener=net.createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');
  const port=listener.address().port;await new Promise(r=>listener.close(r));base='http://127.0.0.1:'+port;
  child=spawn(process.execPath,['server.js'],{env:{...process.env,NODE_ENV:'test',PORT:String(port),DATABASE_URL:'',STORAGE_SIGNER_URL:'',STORAGE_SIGNER_KEY:'',FRONTEND_ORIGIN:'https://roseen.ru',ROSEEN_DATA_DIR:directory,JWT_SECRET:'synthetic-security-qa-secret',ADMIN_EMAIL:'qa@example.test',ADMIN_PASSWORD:'synthetic-qa-password'},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('startup timeout')),20000);
    child.once('exit',()=>{clearTimeout(timeout);reject(Error('server exited'))});
    child.stdout.on('data',d=>{if(String(d).includes('listening on')){clearTimeout(timeout);resolve();}});
  });
}
async function stop(){if(child&&child.exitCode===null){child.kill();await once(child,'exit');}}
before(start);
after(async()=>{await stop();fs.rmSync(directory,{recursive:true,force:true});});
const request=(route,options={})=>fetch(base+route,options);
function form(bytes=png,name='qa.png',type='image/png'){
  const data=new FormData();for(const [key,value] of Object.entries({equipment_type:'Электроника',model:'Synthetic QA',problem:'Isolated test only',contact:'qa@example.test',website:''}))data.set(key,value);
  data.append('files',new Blob([bytes],{type}),name);return data;
}
function untouched(){
  const db=new Database(path.join(directory,'roseen.db'),{readonly:true});
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM requests').get().n,0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM files').get().n,0);db.close();
  assert.deepEqual(fs.readdirSync(path.join(directory,'uploads')),[]);
}

test('API never serves repository files or unknown routes, including encoded paths',async()=>{
  for(const route of ['/server.js','/%73erver.js','/%2573erver.js','/security.mjs','/package.json','/page-template.html','/style.css.bak','/README.md','/tests/render-honeypot.test.mjs','/data/roseen.db','/uploads/qa.png','/roman_elenchuk_multipage_site_mobile.zip','/not-a-page','/api/unknown']){
    const response=await request(route);assert.equal(response.status,404,route);assert.equal(await response.text(),'');
    assert.equal(response.headers.get('cache-control'),'no-store');assert.match(response.headers.get('x-robots-tag'),/noindex/);
  }
  for(const [route,target] of [['/',''],['/admin.html','admin.html'],['/appliances.html','directions.html'],['/robots.html','robotics.html'],['/request.html','contacts.html#request']]){
    const response=await request(route,{redirect:'manual'});assert.equal(response.status,301);
    assert.equal(response.headers.get('location'),'https://roseen.ru/'+target);
  }
  assert.equal((await request('/api/auth/session')).status,404,'legacy authentication contract unchanged');
});

test('foreign origins, malformed fields, signatures and excess uploads fail without storing data',async()=>{
  assert.equal((await request('/api/requests',{method:'POST',headers:{Origin:'https://attacker.invalid'},body:form()})).status,403);untouched();
  const invalids=[form(Buffer.from('not a PNG')),form(png,'qa.html'),form(Buffer.alloc(3*1024*1024+1))];
  const blank=form();blank.set('problem','   ');invalids.push(blank);
  const oversized=form();oversized.set('contact','a'.repeat(301));invalids.push(oversized);
  const repeated=form();repeated.append('contact','second@example.test');invalids.push(repeated);
  const extraField=form();extraField.set('extra','invalid');invalids.push(extraField);
  const excessFiles=form();for(let i=0;i<3;i++)excessFiles.append('files',new Blob([png],{type:'image/png'}),'extra.png');invalids.push(excessFiles);
  const excessTotal=form(Buffer.concat([png,Buffer.alloc(2*1024*1024)]));excessTotal.append('files',new Blob([Buffer.concat([png,Buffer.alloc(2*1024*1024)])],{type:'image/png'}),'second.png');invalids.push(excessTotal);
  for(const data of invalids){assert.equal((await request('/api/requests',{method:'POST',body:data})).status,400);untouched();}
});

test('valid frontend fields, Bearer admin and exact attachment persistence survive restart',async()=>{
  const sent=await request('/api/requests',{method:'POST',headers:{Origin:'https://roseen.ru'},body:(()=>{const data=form();data.set('category','Электроника');data.set('symptom','Isolated test only');return data;})()});assert.equal(sent.status,201);assert.equal(sent.headers.get('access-control-allow-origin'),'https://roseen.ru');const id=(await sent.json()).id;
  assert.equal((await request('/api/requests')).status,401);assert.equal((await request('/api/files/1')).status,401);
  const login=await request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'qa@example.test',password:'synthetic-qa-password'})});assert.equal(login.status,200);
  const token=(await login.json()).token;const headers={Authorization:'Bearer '+token};
  let row=await (await request('/api/requests/'+id,{headers})).json();const fileId=row.files[0].id;
  assert.deepEqual(Buffer.from(await (await request('/api/files/'+fileId,{headers})).arrayBuffer()),png);
  assert.equal((await request('/api/requests/'+id,{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({status:'ready',comment:'Synthetic isolated QA'})})).status,200);
  await stop();await start();
  row=await (await request('/api/requests/'+id,{headers})).json();assert.equal(row.status,'ready');assert.equal(row.contact,'qa@example.test');
  assert.deepEqual(Buffer.from(await (await request('/api/files/'+fileId,{headers})).arrayBuffer()),png);
});
