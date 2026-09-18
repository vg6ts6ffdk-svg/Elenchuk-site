import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'roseen-test-'));
let child,base,cookie,id,fileId;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lN8AAAAASUVORK5CYII=','base64');
before(async()=>{
  child=spawn(process.execPath,['server.js'],{env:{...process.env,NODE_ENV:'test',PORT:'0',HOST:'127.0.0.1',DATABASE_URL:'',VERCEL:'',JWT_SECRET:'synthetic-test-secret-not-for-production-2026',ADMIN_EMAIL:'qa@example.test',ADMIN_PASSWORD:'synthetic-test-password',ROSEEN_DATA_DIR:directory},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Server startup timeout')),60000);
    child.stderr.on('data',d=>process.stderr.write(d));
    child.stdout.on('data',d=>{process.stdout.write(d);const match=String(d).match(/listening on (\d+)/);if(match){base='http://127.0.0.1:'+match[1];clearTimeout(timeout);resolve();}});
    child.on('exit',code=>{clearTimeout(timeout);reject(new Error('Server exited '+code));});
  });
});
after(async()=>{
  if(child && child.exitCode===null){child.kill();await once(child,'exit');}
  assert.ok(directory.startsWith(path.join(os.tmpdir(),'roseen-test-')));
  fs.rmSync(directory,{recursive:true,force:true});
});
const request=(route,options={})=>fetch(base+route,options);
const json=(data,method='POST')=>({method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});
function form(valid=true,contents=png){const data=new FormData();data.set('equipment_type','Электроника');data.set('model','QA');data.set('problem',valid?'Тестовая неисправность':'');data.set('contact','qa@example.test');data.append('files',new Blob([contents],{type:'image/png'}),'qa.png');return data;}
test('health and private source protection',async()=>{
  assert.equal((await request('/api/health')).status,200);
  for(const route of ['/server.js','/package.json','/.env','/data/roseen.db','/page-template.html','/style.css.bak','/not-a-page']) assert.equal((await request(route)).status,404,route);
  assert.equal((await request('/api/requests')).status,401);
  assert.equal((await request('/api/files/1')).status,401);
});
test('rejects foreign origins and invalid uploads without orphan files',async()=>{
  assert.equal((await request('/api/requests',{method:'POST',headers:{Origin:'https://attacker.invalid'},body:form()})).status,403);
  assert.equal((await request('/api/requests',{method:'POST',body:form(false)})).status,400);
  assert.equal((await request('/api/requests',{method:'POST',body:form(true,Buffer.from('not a PNG'))})).status,400);
  assert.deepEqual(fs.readdirSync(path.join(directory,'uploads')),[]);
});
test('saves request and authenticates protected session',async()=>{
  const response=await request('/api/requests',{method:'POST',body:form()});assert.equal(response.status,201);id=(await response.json()).id;assert.ok(Number.isInteger(id));
  const login=await request('/api/auth/login',json({email:'qa@example.test',password:'synthetic-test-password'}));assert.equal(login.status,200);
  assert.match(login.headers.get('set-cookie'),/HttpOnly/i);cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/api/auth/session',{headers:{Cookie:cookie}})).status,200);
  const detail=await (await request('/api/requests/'+id,{headers:{Cookie:cookie}})).json();assert.equal(detail.contact,'qa@example.test');fileId=detail.files[0].id;
  const download=await request('/api/files/'+fileId,{headers:{Cookie:cookie}});assert.equal(download.status,200);assert.deepEqual(Buffer.from(await download.arrayBuffer()),png);
});
test('pagination, update and revoked logout',async()=>{
  assert.equal((await request('/api/requests?limit=1.5',{headers:{Cookie:cookie}})).status,200);
  assert.equal((await request('/api/requests/'+id,json({status:'ready',comment:'QA completed'},'PATCH'))).status,200);
  const detail=await (await request('/api/requests/'+id,{headers:{Cookie:cookie}})).json();assert.equal(detail.status,'ready');
  assert.equal((await request('/api/auth/logout',{method:'POST',headers:{Cookie:cookie}})).status,200);
  assert.equal((await request('/api/auth/session',{headers:{Cookie:cookie}})).status,401);
});
