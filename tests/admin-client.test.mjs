import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAdminClient} from '../admin-client.mjs';
const reply=(status,data)=>new Response(data==null?null:JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});

test('empty API configuration resolves to the page origin on Vercel and localhost',async()=>{
  for(const pageOrigin of ['https://preview.example.vercel.app','http://localhost:3000']){
    const calls=[];
    const client=createAdminClient('',async(url,options)=>{
      calls.push(url);
      if(url.endsWith('/api/auth/session'))return reply(401,{});
      if(url.endsWith('/api/auth/login'))return reply(200,{ok:true});
      assert.equal(options.credentials,'include');
      return reply(200,[]);
    },pageOrigin);
    assert.equal(await client.restoreSession(),false);
    await client.login('qa@example.test','synthetic-password');
    assert.deepEqual(await (await client.request('/api/requests')).json(),[]);
    assert.ok(calls.every(url=>new URL(url).origin===pageOrigin));
  }
  assert.throws(()=>createAdminClient('',undefined,'http://preview.example.test'),/HTTPS/);
});

test('deployed Bearer API supports login, request list and protected download without credentialed CORS',async()=>{
  const calls=[];
  const client=createAdminClient('https://api.example.test',async(url,options)=>{
    calls.push({url,options});
    assert.equal(options.credentials,'omit');
    if(url.endsWith('/api/auth/session')) return reply(404);
    if(url.endsWith('/api/auth/login')) return reply(200,{token:'synthetic-token'});
    assert.equal(options.headers.get('Authorization'),'Bearer synthetic-token');
    if(url.endsWith('/api/requests')) return reply(200,[{id:1}]);
    return new Response('synthetic-file');
  });
  assert.equal(await client.restoreSession(),false);
  await client.login('qa@example.test','synthetic-password');
  assert.deepEqual(await (await client.request('/api/requests')).json(),[{id:1}]);
  assert.equal(await (await client.request('/api/files/1')).text(),'synthetic-file');
  assert.equal(client.isLegacy(),true);
  assert.equal(calls.filter(x=>x.url.endsWith('/api/auth/session')).length,1);
});

test('Bearer logout and expiry clear memory; a fresh page requires a new login',async()=>{
  let reject=false;
  const fetcher=async(url,options)=>{
    if(url.endsWith('/api/auth/session'))return reply(404);
    if(url.endsWith('/api/auth/login'))return reply(200,{token:'synthetic-token'});
    if(reject)return reply(401,{error:'expired'});
    return reply(options.headers.has('Authorization')?200:401,{});
  };
  const client=createAdminClient('https://api.example.test',fetcher);
  await client.login('qa@example.test','synthetic-password');
  assert.equal((await client.request('/api/requests')).status,200);
  await client.logout();
  assert.equal((await client.request('/api/requests')).status,401);
  await client.login('qa@example.test','synthetic-password');reject=true;
  assert.equal((await client.request('/api/files/1')).status,401);reject=false;
  assert.equal((await client.request('/api/requests')).status,401);
  const reloaded=createAdminClient('https://api.example.test',fetcher);
  assert.equal(await reloaded.restoreSession(),false);
  assert.equal((await reloaded.request('/api/requests')).status,401);
});

test('cookie API keeps the current session/login/logout contract and sends no Bearer header',async()=>{
  let loggedIn=true;
  const client=createAdminClient('https://api.example.test',async(url,options)=>{
    assert.equal(options.headers?.has('Authorization')||false,false);
    if(options.credentials==='omit'){assert.ok(url.endsWith('/api/auth/session'));return reply(401,{});}
    assert.equal(options.credentials,'include');
    if(url.endsWith('/api/auth/login')){loggedIn=true;return reply(200,{ok:true});}
    if(url.endsWith('/api/auth/logout')){loggedIn=false;return reply(200,{ok:true});}
    return reply(loggedIn?200:401,{ok:loggedIn});
  });
  assert.equal(await client.restoreSession(),true);
  assert.equal(client.isLegacy(),false);
  await client.login('qa@example.test','synthetic-password');
  assert.equal((await client.request('/api/requests')).status,200);
  await client.logout();assert.equal(await client.restoreSession(),false);
});

test('server and network errors never silently downgrade cookie authentication',async()=>{
  for(const failure of [()=>reply(503,{}),()=>{throw new TypeError('network');}]){
    let broken=true,logins=0;
    const client=createAdminClient('https://api.example.test',async(url,options)=>{
      if(broken)return failure();
      if(options.credentials==='omit')return reply(401,{});
      if(url.endsWith('/api/auth/login')){logins++;return reply(200,{ok:true});}
      return reply(200,{ok:true});
    });
    await assert.rejects(client.login('qa@example.test','synthetic-password'));
    assert.equal(client.isLegacy(),false);assert.equal(logins,0);
    broken=false;await client.login('qa@example.test','synthetic-password');assert.equal(logins,1);
  }
});

test('unconfirmed login never authorizes later requests',async()=>{
  let headers;
  const client=createAdminClient('https://api.example.test',async(url,options)=>{
    if(url.endsWith('/api/auth/session'))return reply(404);
    if(url.endsWith('/api/auth/login'))return reply(200,{ok:true});
    headers=options.headers;return reply(401,{});
  });
  await assert.rejects(client.login('qa@example.test','synthetic-password'),/не подтвердил/);
  await client.request('/api/requests');assert.equal(headers.has('Authorization'),false);
});

test('only the trusted HTTPS API is used and concurrent probes share one request',async()=>{
  assert.throws(()=>createAdminClient('http://api.example.test'),/HTTPS/);
  let probes=0;
  const client=createAdminClient('https://api.example.test',async url=>{
    if(url.endsWith('/api/auth/session')){probes++;return reply(404);}
    return reply(401,{});
  });
  await Promise.all([client.restoreSession(),client.restoreSession()]);assert.equal(probes,1);
  await assert.rejects(client.request('https://other.example.test/api/requests'),/Недопустимый/);
});
