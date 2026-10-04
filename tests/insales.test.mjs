import test from 'node:test';
import assert from 'node:assert/strict';
import { createInSalesCatalogReader, inSalesStatus, previewInSalesProducts, rublesToMinor } from '../commerce/insales.mjs';
const env = { INSALES_SHOP_HOST: 'synthetic-test.myinsales.ru', INSALES_API_KEY: 'test-only-key', INSALES_API_PASSWORD: 'test-only-secret' };
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const mapping = { categories: { 5: 'belts' }, manufacturers: { 7: 'Synthetic test manufacturer' }, units: { pce: 'шт.' } };
const fixture = () => ({ id: 7, category_id: 5, title: 'Synthetic fixture only', unit: 'pce', currency_code: 'RUB', available: true,
  variants: [{ id: 11, product_id: 7, sku: 'TEST-ONLY-11', title: 'Test variant', available: true, price: '100.01', price_in_site_currency: '999.99', quantity: '2.0' }] });
const preview = rows => previewInSalesProducts(rows, { mapping, allowedCategories: ['belts'] });

test('connector is disabled without credentials; status cannot expose secrets', () => {
  assert.throws(() => createInSalesCatalogReader({ env: {} }), { code: 'COMMERCE_BACKEND_DISABLED' });
  assert.equal(inSalesStatus({ ...env, INSALES_API_PASSWORD: '  ' }).configured, false);
  assert.deepEqual(inSalesStatus(env), { provider: 'insales', configured: true, readOnly: true, checkoutEnabled: false });
  assert.doesNotMatch(JSON.stringify(inSalesStatus(env)), /test-only|myinsales/);
});
test('only a trusted technical TLS host can receive credentials', () => {
  for (const host of ['127.0.0.1', 'localhost', 'https://synthetic-test.myinsales.ru', 'synthetic-test.myinsales.ru.evil.invalid', 'synthetic-test.myinsales.ru:443', 'evil.invalid', 'x.myinsales.ru/path']) {
    assert.throws(() => createInSalesCatalogReader({ env: { ...env, INSALES_SHOP_HOST: host } }), { code: 'INSALES_CONFIG_INVALID' });
  }
});
test('client uses bounded GET pagination, refuses redirects, and keeps authentication in a header', async () => {
  let calls = 0;
  const reader = createInSalesCatalogReader({ env, fetchImpl: async (url, options) => {
    calls++; assert.equal(url.href, 'https://synthetic-test.myinsales.ru/admin/products.json?page=2&per_page=50');
    assert.equal(url.username, ''); assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
    assert.ok(options.signal); assert.equal(options.headers.Authorization, 'Basic ' + Buffer.from('test-only-key:test-only-secret').toString('base64'));
    return json([fixture()]);
  } });
  assert.equal((await reader.listProducts({ page: 2 })).length, 1);
  for (const query of [{ page: -1 }, { perPage: 101 }, { page: '1' }]) await assert.rejects(reader.listProducts(query), TypeError);
  assert.equal(calls, 1);
});
test('product lookup rejects path injection and wrong product identity', async () => {
  const reader = createInSalesCatalogReader({ env, fetchImpl: async () => json(fixture()) });
  await assert.rejects(reader.getProduct('../orders'), TypeError);
  await assert.rejects(reader.getProduct(Number.MAX_SAFE_INTEGER + 1), TypeError);
  await assert.rejects(reader.getProduct(8), { code: 'INSALES_RESPONSE_INVALID' });
  assert.equal((await reader.getProduct(7)).id, 7);
});
test('transport/auth/rate-limit errors do not leak source bodies or credentials', async () => {
  for (const status of [401, 403, 429, 500]) {
    const reader = createInSalesCatalogReader({ env, fetchImpl: async () => new Response('PRIVATE SOURCE test-only-secret', { status, headers: { 'retry-after': '30' } }) });
    await assert.rejects(reader.listProducts(), e => e.status === status && e.retryAfter === 30 && !/PRIVATE|test-only/.test(e.message));
  }
  const reader = createInSalesCatalogReader({ env, fetchImpl: async () => { throw new Error('private URL test-only-secret'); } });
  await assert.rejects(reader.listProducts(), { code: 'INSALES_UNAVAILABLE' });
});
test('non-JSON, oversized, or non-array catalogue responses are rejected', async () => {
  for (const response of [new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } }), json({ products: [] }), new Response('[]', { headers: { 'content-type': 'application/json', 'content-length': String(5 * 1024 * 1024) } })]) {
    const reader = createInSalesCatalogReader({ env, fetchImpl: async () => response });
    await assert.rejects(reader.listProducts(), { code: 'INSALES_RESPONSE_INVALID' });
  }
});
test('rejected source bodies are cancelled without reading or retaining private content', async () => {
  for (const status of [200, 401]) {
    let cancelled = false;
    const body = new ReadableStream({ cancel() { cancelled = true; } });
    const reader = createInSalesCatalogReader({ env, fetchImpl: async () => new Response(body, { status, headers: { 'content-type': 'text/html' } }) });
    await assert.rejects(reader.listProducts());
    assert.equal(cancelled, true);
  }
});
test('RUB conversion is exact and rejects zero, overflow, exponent and fractional kopecks', () => {
  assert.equal(rublesToMinor('100.01'), 10001); assert.equal(rublesToMinor('0.29'), 29);
  assert.equal(rublesToMinor('19.9'), 1990); assert.equal(rublesToMinor(null), null);
  for (const bad of ['0', '-1', '1.005', '1e2', '100,50', '90071992547409.92', true]) assert.throws(() => rublesToMinor(bad), TypeError);
});
test('variants keep identity, base RUB prices and stock, but imports never publish or confirm compatibility', () => {
  const result = preview([fixture()]); assert.equal(result.ok, true);
  const p = result.catalog.products[0]; assert.equal(p.id, 'insales-11'); assert.equal(p.priceMinor, 10001);
  assert.equal(p.stock, 2); assert.equal(p.availability, 'in_stock'); assert.equal(p.state, 'draft');
  assert.equal(p.verifiedAt, null); assert.deepEqual(p.compatibility, []); assert.deepEqual(p.oem, []);
  assert.equal(result.commitAllowed, false); assert.equal(result.checkoutEnabled, false);
  assert.doesNotMatch(JSON.stringify(result), /999\.99|cost_price|test-only-secret/);
});
test('unknown quantity and explicit zero stay distinct; availability alone cannot prove stock', () => {
  const p = fixture(); p.variants[0].quantity = null;
  let result = preview([p]); assert.equal(result.catalog.products[0].stock, null); assert.equal(result.catalog.products[0].availability, 'unknown');
  p.variants[0].quantity = 0; result = preview([p]); assert.equal(result.catalog.products[0].availability, 'out_of_stock');
  p.variants[0].quantity = 2; p.variants[0].available = false; result = preview([p]); assert.equal(result.catalog.products[0].availability, 'unknown');
  p.variants[0].quantity = -1; result = preview([p]); assert.equal(result.ok, false); assert.equal(result.catalog, null);
});
test('no partial draft file is accepted with a wrong currency, absent mapping, duplicate SKU or invalid price', () => {
  const currency = fixture(); currency.currency_code = 'USD';
  const price = fixture(); price.variants[0].price = '100.001';
  const duplicate = fixture(); duplicate.variants.push({ ...duplicate.variants[0], id: 12 });
  for (const rows of [[currency], [price], [duplicate], [fixture(), fixture()]]) {
    const r = preview(rows); assert.equal(r.ok, false); assert.equal(r.catalog, null); assert.equal(r.summary.published, 0);
  }
  const r = previewInSalesProducts([fixture()], { allowedCategories: ['belts'] });
  assert.equal(r.ok, false); assert.equal(r.catalog, null); assert.ok(r.errors.some(e => e.field === 'manufacturer'));
});
test('hidden and archived products are omitted; bundles cannot be treated as simple stock', () => {
  const p = fixture(); p.is_hidden = true; assert.equal(preview([p]).catalog.products.length, 0);
  p.is_hidden = false; p.archived = true; assert.equal(preview([p]).catalog.products.length, 0);
  p.archived = false; p.bundle = true; assert.equal(preview([p]).ok, false);
});
test('unsafe numeric identities cannot be silently rounded into valid source references', () => {
  const p = fixture(); p.id = Number.MAX_SAFE_INTEGER + 1;
  assert.equal(preview([p]).ok, false);
  p.id = 7; p.variants[0].id = Number.MAX_SAFE_INTEGER + 1;
  assert.equal(preview([p]).ok, false);
  assert.throws(() => previewInSalesProducts([fixture()], { mapping: null }), TypeError);
});
test('many variants cannot bypass the bounded import limit', () => {
  const manufacturers = {}, rows = Array.from({ length: 6 }, (_, i) => {
    const p = fixture(); p.id = i + 1; manufacturers[p.id] = 'Synthetic test manufacturer';
    p.variants = Array.from({ length: 1000 }, (_, j) => ({ ...p.variants[0], id: i * 1000 + j + 1, product_id: p.id, sku: 'TEST-ONLY-' + (i * 1000 + j + 1) }));
    return p;
  });
  const result = previewInSalesProducts(rows, { mapping: { ...mapping, manufacturers }, allowedCategories: ['belts'] });
  assert.equal(result.ok, false); assert.equal(result.catalog, null); assert.equal(result.summary.drafts, 0);
  assert.ok(result.errors.some(e => e.field === 'variants'));
});
test('invalid and hidden source variants cannot grow an unbounded validation report', () => {
  const rows = Array.from({ length: 6 }, (_, i) => ({ ...fixture(), id: i + 1, variants: Array.from({ length: 1000 }, () => ({})) }));
  for (const hidden of [false, true]) {
    for (const p of rows) p.is_hidden = hidden;
    const result = preview(rows);
    assert.equal(result.ok, false); assert.equal(result.catalog, null); assert.equal(result.summary.drafts, 0);
    assert.equal(result.errors.length, 1); assert.equal(result.errors[0].field, 'variants');
    assert.equal(result.commitAllowed, false); assert.equal(result.checkoutEnabled, false);
  }
});
