import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { importInSalesDrafts } from '../scripts/import-insales.mjs';

const fixture = () => ({ id: 7, updated_at: '2026-10-01T00:00:00.000Z', category_id: 5, title: 'Synthetic fixture only', unit: 'pce', currency_code: 'RUR', available: true,
  variants: [{ id: 11, product_id: 7, sku: 'TEST-ONLY-11', price: '100.01', quantity: 2, available: true }] });
const mapping = { categories: { 5: 'belts' }, manufacturers: { 7: 'Synthetic test manufacturer' }, units: { pce: 'шт.' } };
async function temporary(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'roseen-insales-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const mappingPath = path.join(directory, 'mapping.json'), outputPath = path.join(directory, 'drafts.json');
  await fs.writeFile(mappingPath, JSON.stringify(mapping), { mode: 0o600 });
  return { directory, mappingPath, outputPath };
}
test('draft import writes private output only and cannot overwrite an existing reviewed snapshot', async t => {
  const options = await temporary(t);
  const reader = { async listProducts(query) { assert.equal(query.page, 1); assert.equal(query.perPage, 100); assert.ok(query.updatedSince); return query.fromId ? [] : [fixture()]; } };
  const result = await importInSalesDrafts({ ...options, reader });
  assert.equal(result.ok, true); assert.equal(result.published, false); assert.equal(result.checkoutEnabled, false);
  const saved = JSON.parse(await fs.readFile(options.outputPath, 'utf8'));
  assert.equal(saved.currency, 'RUB');
  assert.equal(saved.products[0].state, 'draft'); assert.equal(saved.products[0].verifiedAt, null);
  assert.equal((await fs.stat(options.outputPath)).mode & 0o777, 0o600);
  await assert.rejects(importInSalesDrafts({ ...options, reader }), { code: 'EEXIST' });
  assert.deepEqual(JSON.parse(await fs.readFile(options.outputPath, 'utf8')), saved);
});
test('repository output and symlinks into the website are refused before fetching source data', async t => {
  const options = await temporary(t), root = fileURLToPath(new URL('../', import.meta.url));
  let fetched = false;
  const reader = { async listProducts(query) { fetched = true; return query.fromId ? [] : [fixture()]; } };
  await assert.rejects(importInSalesDrafts({ ...options, outputPath: path.join(root, 'private-drafts.json'), reader }), /outside the website/);
  await fs.symlink(root, path.join(options.directory, 'site-link'), 'dir');
  await assert.rejects(importInSalesDrafts({ ...options, outputPath: path.join(options.directory, 'site-link', 'private-drafts.json'), reader }), /outside the website/);
  assert.equal(fetched, false);
});
test('invalid source rows return a safe error report and leave no output file', async t => {
  const options = await temporary(t), p = fixture(); p.currency_code = 'USD';
  p.private_provider_notes = 'PRIVATE SOURCE';
  const result = await importInSalesDrafts({ ...options, reader: { async listProducts(query) { return query.fromId ? [] : [p]; } } });
  assert.equal(result.ok, false); assert.equal(result.summary.drafts, 0);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE SOURCE|Synthetic fixture/);
  await assert.rejects(fs.stat(options.outputPath), { code: 'ENOENT' });
});
test('overlapping provider pages abort rather than omitting or duplicating products', async t => {
  const options = await temporary(t); let calls = 0;
  const reader = { async listProducts({ fromId }) { calls++; return fromId === undefined ? Array.from({ length: 100 }, (_, i) => ({ id: i + 1, updated_at: '2026-10-01T00:00:00.000Z' })) : [{ id: 1 }]; } };
  await assert.rejects(importInSalesDrafts({ ...options, reader }), /Repeated product during pagination/);
  assert.equal(calls, 2); await assert.rejects(fs.stat(options.outputPath), { code: 'ENOENT' });
});
test('pagination cannot fetch or emit an unbounded catalogue', async t => {
  const options = await temporary(t); let calls = 0;
  const reader = { async listProducts({ fromId }) { calls++; return Array.from({ length: 100 }, (_, i) => ({ id: Number(fromId ?? 0) + i + 1, updated_at: '2026-10-01T00:00:00.000Z' })); } };
  await assert.rejects(importInSalesDrafts({ ...options, reader }), /5000-product import limit/);
  assert.equal(calls, 51); await assert.rejects(fs.stat(options.outputPath), { code: 'ENOENT' });
});
