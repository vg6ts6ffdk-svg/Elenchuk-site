/** Shared server/CLI draft loader. Never writes to inSales or the public catalogue. */
import { createInSalesCatalogReader, InSalesError, previewInSalesProducts, validateInSalesMapping } from './insales.mjs';

const MAX_SOURCE_BYTES = 16 * 1024 * 1024;

export async function loadInSalesDrafts({ mapping, allowedCategories, env = process.env, fetchImpl = globalThis.fetch,
  reader: suppliedReader, signal = AbortSignal.timeout(30000) } = {}) {
  validateInSalesMapping(mapping, allowedCategories);
  if (signal.aborted) throw new InSalesError('INSALES_TIMEOUT', 'Загрузка каталога превысила время ожидания.');
  const reader = suppliedReader ?? createInSalesCatalogReader({ env, fetchImpl, signal });
  const rows = [], seen = new Set(); let sourceBytes = 0;
  for (let page = 1; page <= 51; page++) {
    if (signal.aborted) throw new InSalesError('INSALES_TIMEOUT', 'Загрузка каталога превысила время ожидания.');
    const batch = await reader.listProducts({ page, perPage: 100 });
    if (signal.aborted) throw new InSalesError('INSALES_TIMEOUT', 'Загрузка каталога превысила время ожидания.');
    sourceBytes += Buffer.byteLength(JSON.stringify(batch), 'utf8');
    if (sourceBytes > MAX_SOURCE_BYTES) throw new InSalesError('INSALES_CATALOG_TOO_LARGE', 'Каталог превышает лимит загрузки 16 МБ.');
    for (const p of batch) {
      const id = String(p?.id ?? '');
      if (seen.has(id)) throw new TypeError('Repeated product during pagination; retry with a stable catalogue snapshot');
      seen.add(id); rows.push(p);
    }
    if (rows.length > 5000) throw new TypeError('Catalogue exceeds the 5000-product import limit');
    if (batch.length < 100) break;
  }
  return previewInSalesProducts(rows, { mapping, allowedCategories });
}

/** A successful request proves product-read access only, never readiness for sales. */
export async function checkInSalesConnection({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const reader = createInSalesCatalogReader({ env, fetchImpl });
  await reader.listProducts({ page: 1, perPage: 1 });
  return { provider: 'insales', connected: true, catalogReadVerified: true, readOnly: true, checkoutEnabled: false };
}
