/** Shared server/CLI draft loader. Never writes to inSales or the public catalogue. */
import { createInSalesCatalogReader, inSalesProductCursor, InSalesError, previewInSalesProducts, validateInSalesMapping } from './insales.mjs';

const MAX_SOURCE_BYTES = 16 * 1024 * 1024;

export async function loadInSalesDrafts({ mapping, allowedCategories, env = process.env, fetchImpl = globalThis.fetch,
  reader: suppliedReader, signal = AbortSignal.timeout(30000) } = {}) {
  validateInSalesMapping(mapping, allowedCategories);
  if (signal.aborted) throw new InSalesError('INSALES_TIMEOUT', 'Загрузка каталога превысила время ожидания.');
  const reader = suppliedReader ?? createInSalesCatalogReader({ env, fetchImpl, signal });
  const rows = [], seen = new Set(); let sourceBytes = 0, sourceVariants = 0;
  let cursor = { updatedSince: '1970-01-01T00:00:00.000Z' }, previousTime = 0, previousId = 0n;
  // Offset pages can skip a product if an earlier item is deleted or re-ordered.
  // Always read page 1 using the provider's updated_since/from_id cursor until empty.
  for (let request = 1; request <= 51; request++) {
    if (signal.aborted) throw new InSalesError('INSALES_TIMEOUT', 'Загрузка каталога превысила время ожидания.');
    const batch = await reader.listProducts({ page: 1, perPage: 100, ...cursor });
    if (signal.aborted) throw new InSalesError('INSALES_TIMEOUT', 'Загрузка каталога превысила время ожидания.');
    if (!Array.isArray(batch) || batch.length > 100) throw new InSalesError('INSALES_RESPONSE_INVALID', 'inSales вернул некорректные данные каталога.');
    if (!batch.length) return previewInSalesProducts(rows, { mapping, allowedCategories });
    sourceBytes += Buffer.byteLength(JSON.stringify(batch), 'utf8');
    if (sourceBytes > MAX_SOURCE_BYTES) throw new InSalesError('INSALES_CATALOG_TOO_LARGE', 'Каталог превышает лимит загрузки 16 МБ.');
    for (const p of batch) {
      sourceVariants += Array.isArray(p?.variants) ? p.variants.length : 0;
      if (sourceVariants > 5000) throw new InSalesError('INSALES_CATALOG_TOO_LARGE', 'Каталог превышает лимит загрузки 5000 вариантов.');
      const id = String(p?.id ?? '');
      if (seen.has(id)) throw new TypeError('Repeated product during pagination; retry with a stable catalogue snapshot');
      const nextCursor = inSalesProductCursor(p), nextTime = Date.parse(nextCursor.updatedSince), nextId = BigInt(nextCursor.fromId);
      if (nextTime < previousTime || (nextTime === previousTime && nextId <= previousId)) {
        throw new InSalesError('INSALES_RESPONSE_INVALID', 'Каталог inSales не продвигается в ожидаемом порядке. Повторите загрузку после проверки источника.');
      }
      cursor = nextCursor; previousTime = nextTime; previousId = nextId;
      seen.add(id); rows.push(p);
    }
    if (rows.length > 5000) throw new TypeError('Catalogue exceeds the 5000-product import limit');
  }
  throw new InSalesError('INSALES_CATALOG_TOO_LARGE', 'Загрузка каталога превысила лимит 51 запроса. Частичный импорт не сохранён.');
}

/** A successful request proves product-read access only, never readiness for sales. */
export async function checkInSalesConnection({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const reader = createInSalesCatalogReader({ env, fetchImpl });
  await reader.listProducts({ page: 1, perPage: 1 });
  return { provider: 'insales', connected: true, catalogReadVerified: true, readOnly: true, checkoutEnabled: false };
}
