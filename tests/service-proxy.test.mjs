import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { createServiceProxy } from '../service-proxy.mjs';

async function withProxy(run) {
  const calls = [];
  const upstream = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    calls.push({ path: req.url, method: req.method, headers: req.headers, body: Buffer.concat(chunks) });
    if (req.url === '/api/auth/session') return res.writeHead(404).end();
    if (req.url === '/api/health') return res.writeHead(503, { 'Content-Type': 'text/html' }).end('Upstream startup page');
    if (req.url === '/api/files/99') return res.writeHead(302, { Location: 'https://example.test/elsewhere' }).end();
    if (req.url === '/api/files/7') {
      return res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': "attachment; filename*=UTF-8''test.pdf",
      }).end(Buffer.from([0, 255, 10]));
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': ['__Host-roseen_session=synthetic; Secure; Path=/; HttpOnly', 'unrelated=ignored'],
    }).end('{"ok":true}');
  }).listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  const app = express();
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(createServiceProxy((target, options, callback) => {
    assert.equal(target.origin, 'https://api.roseen.ru');
    return request('http://127.0.0.1:' + upstream.address().port + target.pathname + target.search, options, callback);
  }));
  app.use((_req, res) => res.status(404).end());
  const proxy = app.listen(0, '127.0.0.1');
  await once(proxy, 'listening');
  try {
    await run('http://127.0.0.1:' + proxy.address().port, calls);
  } finally {
    await Promise.all([proxy, upstream].map(server => new Promise(resolve => server.close(resolve))));
  }
}

test('Vercel bridge preserves service requests, signed-in access and binary download', () => withProxy(async (base, calls) => {
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://roseen-preview.example',
      Cookie: 'analytics=ignored; __Host-roseen_session=synthetic',
    },
    body: '{"email":"qa@example.test","password":"synthetic-password"}',
  });
  assert.equal(login.status, 200);
  assert.deepEqual(login.headers.getSetCookie(), ['__Host-roseen_session=synthetic; Secure; Path=/; HttpOnly']);
  assert.equal(login.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await login.json(), { ok: true });
  assert.equal(calls[0].headers.origin, undefined);
  assert.equal(calls[0].headers.cookie, '__Host-roseen_session=synthetic');
  assert.equal(JSON.parse(calls[0].body).email, 'qa@example.test');

  const attachment = await fetch(base + '/api/files/7', { headers: { Authorization: 'Bearer fixture' } });
  assert.equal(calls[1].headers.authorization, 'Bearer fixture');
  assert.match(attachment.headers.get('content-disposition'), /test\.pdf/);
  assert.deepEqual(Buffer.from(await attachment.arrayBuffer()), Buffer.from([0, 255, 10]));

  const form = new FormData();
  form.set('problem', 'Synthetic service request');
  form.set('files', new Blob([Buffer.from([1, 2, 3])]), 'fixture.png');
  assert.equal((await fetch(base + '/api/requests', { method: 'POST', body: form })).status, 200);
  assert.match(calls[2].headers['content-type'], /^multipart\/form-data; boundary=/);
  assert.equal(calls[2].body.includes(Buffer.from([1, 2, 3])), true);
}));

test('Vercel bridge retains the legacy session probe and limits routes, query and destinations', () => withProxy(async (base, calls) => {
  assert.equal((await fetch(base + '/api/auth/session')).status, 404);
  assert.equal((await fetch(base + '/api/store-admin/status')).status, 404);
  assert.equal((await fetch(base + '/api/files/7', { method: 'POST' })).status, 404);
  assert.equal((await fetch(base + '/api/requests?before=200&limit=50&url=https://example.test')).status, 200);
  assert.equal(calls[1].path, '/api/requests?before=200&limit=50');
  assert.equal((await fetch(base + '/api/files/99', { redirect: 'manual' })).status, 502);
  const health = await fetch(base + '/api/health');
  assert.equal(health.status, 503);
  assert.match((await health.json()).error, /временно недоступен/);
  assert.equal(calls.length, 4);
}));
