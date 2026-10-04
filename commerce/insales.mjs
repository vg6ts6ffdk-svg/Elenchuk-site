/** Read-only inSales catalogue connector. Credentials and provider responses stay on the server.
 * Official contract: https://api.insales.ru/ (Products → Get products / Get product).
 * This connector does not create orders, reserve stock, publish products or authorize checkout.
 */
import { validateCatalog } from './catalog.mjs';

const MAX_BYTES = 4 * 1024 * 1024;
const identifier = value => (typeof value === 'string' || (typeof value === 'number' && Number.isSafeInteger(value))) && /^[1-9]\d{0,17}$/.test(String(value));
const clean = value => typeof value === 'string' ? value.trim() : '';
const own = (object, key) => Object.prototype.hasOwnProperty.call(object ?? {}, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export class InSalesError extends Error {
  constructor(code, message, { status = null, retryAfter = null } = {}) {
    super(message);
    this.name = 'InSalesError'; this.code = code;
    this.status = status; this.retryAfter = retryAfter;
  }
}
const badResponse = () => new InSalesError('INSALES_RESPONSE_INVALID', 'inSales вернул некорректные данные каталога.');

export function inSalesStatus(env = process.env) {
  return { provider: 'insales', configured: ['INSALES_SHOP_HOST', 'INSALES_API_KEY', 'INSALES_API_PASSWORD'].every(key => clean(env[key]).length > 0), readOnly: true, checkoutEnabled: false };
}

export function createInSalesCatalogReader({ env = process.env, fetchImpl = globalThis.fetch, signal } = {}) {
  if (!inSalesStatus(env).configured) throw new InSalesError('COMMERCE_BACKEND_DISABLED', 'Подключение inSales ещё не настроено.');
  const host = clean(env.INSALES_SHOP_HOST);
  const key = env.INSALES_API_KEY, password = env.INSALES_API_PASSWORD;
  // Only the technical Russian inSales domain is accepted. No localhost, IP, custom URL,
  // arbitrary port, redirect, or browser-provided host can receive the Authorization header.
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myinsales\.ru$/.test(host) ||
      typeof key !== 'string' || typeof password !== 'string' || /[:\r\n]/.test(key) || /[\r\n]/.test(password) ||
      key.length > 512 || password.length > 2048 || typeof fetchImpl !== 'function') {
    throw new InSalesError('INSALES_CONFIG_INVALID', 'Проверьте серверные настройки подключения inSales.');
  }
  const authorization = 'Basic ' + Buffer.from(key + ':' + password, 'utf8').toString('base64');
  async function get(path, params = {}) {
    const url = new URL(path, 'https://' + host);
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, String(value));
    let response;
    try {
      response = await fetchImpl(url, { method: 'GET', redirect: 'error', headers: { Accept: 'application/json', Authorization: authorization }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000) });
    } catch {
      if (signal?.aborted) throw new InSalesError('INSALES_TIMEOUT', 'Загрузка каталога превысила время ожидания.');
      throw new InSalesError('INSALES_UNAVAILABLE', 'Не удалось получить каталог из inSales. Повторите позже.');
    }
    if (!response.ok) {
      const rawRetry = response.headers.get('retry-after');
      const retryAfter = rawRetry !== null && /^\d{1,5}$/.test(rawRetry) ? Math.min(Number(rawRetry), 86400) : null;
      const code = response.status === 429 ? 'INSALES_RATE_LIMIT' : [401, 403].includes(response.status) ? 'INSALES_ACCESS_DENIED' : 'INSALES_UNAVAILABLE';
      try { await response.body?.cancel(); } catch { /* The safe provider error remains authoritative. */ }
      throw new InSalesError(code, code === 'INSALES_ACCESS_DENIED' ? 'Проверьте ключ доступа и права чтения каталога inSales.' : 'Каталог inSales временно недоступен.', { status: response.status, retryAfter });
    }
    if (!/^application\/json\b/i.test(response.headers.get('content-type') ?? '') ||
        Number(response.headers.get('content-length')) > MAX_BYTES || !response.body) {
      try { await response.body?.cancel(); } catch { /* No response body is accepted. */ }
      throw badResponse();
    }
    const reader = response.body.getReader(); let size = 0; const chunks = [];
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) { await reader.cancel(); throw badResponse(); }
        chunks.push(Buffer.from(value));
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      if (signal?.aborted) throw new InSalesError('INSALES_TIMEOUT', 'Загрузка каталога превысила время ожидания.');
      throw badResponse();
    }
    finally { reader.releaseLock(); }
  }
  return Object.freeze({
    async listProducts({ page = 1, perPage = 50 } = {}) {
      if (!Number.isInteger(page) || page < 1 || page > 10000 || !Number.isInteger(perPage) || perPage < 1 || perPage > 100) throw new TypeError('Invalid catalogue pagination');
      const rows = await get('/admin/products.json', { page, per_page: perPage });
      if (!Array.isArray(rows) || rows.length > perPage || rows.some(p => !record(p) || !identifier(p.id))) throw badResponse();
      return rows;
    },
    async getProduct(id) {
      if (!identifier(id)) throw new TypeError('Invalid inSales product id');
      const product = await get('/admin/products/' + String(id) + '.json');
      if (!product || !identifier(product.id) || String(product.id) !== String(id)) throw badResponse();
      return product;
    }
  });
}

/** Validate the merchant's explicit mapping before making any provider request. */
export function validateInSalesMapping(mapping, allowedCategories) {
  if (!record(mapping) || !Array.isArray(allowedCategories) ||
      Object.keys(mapping).some(key => !['categories', 'manufacturers', 'units'].includes(key))) {
    throw new TypeError('Проверьте словари категорий, производителей и единиц продажи.');
  }
  for (const field of ['categories', 'manufacturers', 'units']) {
    const dictionary = mapping[field];
    if (!record(dictionary) || Object.keys(dictionary).length > 5000) throw new TypeError('Проверьте словари соответствий каталога.');
    for (const [key, value] of Object.entries(dictionary)) {
      if ((field === 'units' ? !key || key.length > 64 : !identifier(key)) ||
          !clean(value) || value.length > 128 || (field === 'categories' && !allowedCategories.includes(clean(value)))) {
        throw new TypeError('Некорректное соответствие категории, производителя или единицы продажи.');
      }
    }
  }
  return mapping;
}

/** Exact conversion: never multiply an unrestricted floating point price by 100. */
export function rublesToMinor(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number') throw new TypeError('Invalid RUB amount');
  const match = /^(0|[1-9]\d{0,13})(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) throw new TypeError('RUB amount must have at most two decimal places');
  const minor = BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
  if (minor <= 0n || minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new TypeError('Invalid RUB amount');
  return Number(minor);
}

/** Explicit merchant mapping; names never prove category, manufacturer or compatibility.
 * mapping = { categories: { providerCategoryId: roseenCategory },
 *             manufacturers: { providerProductId: verifiedManufacturer },
 *             units: { providerUnit: approvedUnitLabel } }
 * All variants are drafts. Images, HTML, wholesale costs and source credentials are omitted.
 */
export function previewInSalesProducts(rows, { mapping = {}, allowedCategories = [] } = {}) {
  if (!Array.isArray(rows) || rows.length > 5000) throw new TypeError('Invalid catalogue row count');
  // Missing dictionaries remain an ordinary row-validation error for existing callers.
  if (!record(mapping) || !Array.isArray(allowedCategories)) throw new TypeError('Invalid catalogue mapping');
  const products = [], errors = [], seenProducts = new Set(), seenIds = new Set(), seenSkus = new Set();
  const issue = (row, field, message) => errors.push({ row, field, message });
  // Count all source variants before normalization. Invalid or hidden variants must not
  // bypass the limit and allocate an unbounded row-error report.
  let sourceVariants = 0;
  for (const p of rows) {
    sourceVariants += Array.isArray(p?.variants) ? p.variants.length : 0;
    if (sourceVariants > 5000) {
      issue(0, 'variants', 'Превышен лимит 5000 входящих вариантов за одну загрузку.');
      return { ok: false, errors, catalog: null, summary: { sourceProducts: rows.length, drafts: 0, published: 0 }, commitAllowed: false, checkoutEnabled: false };
    }
  }
  for (let i = 0; i < rows.length; i++) {
    const p = rows[i], row = i + 1;
    if (!p || !identifier(p.id) || seenProducts.has(String(p.id))) { issue(row, 'id', 'Некорректный или повторный ID товара.'); continue; }
    seenProducts.add(String(p.id));
    if (p.archived === true || p.is_hidden === true) continue;
    if (p.bundle === true) { issue(row, 'bundle', 'Комплект требует отдельной проверки состава и остатков.'); continue; }
    // currency_code belongs to the product's base price. price_in_site_currency is deliberately
    // ignored until the site's currency is independently verified; never relabel USD as RUB.
    if (p.currency_code !== 'RUB') { issue(row, 'currency', 'Цена товара должна быть подтверждена в RUB.'); continue; }
    const category = own(mapping.categories, String(p.category_id)) ? clean(mapping.categories[String(p.category_id)]) : '';
    const manufacturer = own(mapping.manufacturers, String(p.id)) ? clean(mapping.manufacturers[String(p.id)]) : '';
    const unit = own(mapping.units, p.unit) ? clean(mapping.units[p.unit]) : '';
    if (!allowedCategories.includes(category)) issue(row, 'category', 'Укажите соответствие категории ROSEEN.');
    if (!manufacturer) issue(row, 'manufacturer', 'Подтвердите производителя товара.');
    if (!unit) issue(row, 'unit', 'Подтвердите единицу продажи.');
    if (!clean(p.title) || p.title.length > 500) issue(row, 'name', 'Проверьте название товара, до 500 символов.');
    if (!Array.isArray(p.variants) || !p.variants.length || p.variants.length > 1000) { issue(row, 'variants', 'Не найдены корректные варианты товара.'); continue; }
    for (const v of p.variants) {
      if (products.length >= 5000) { issue(row, 'variants', 'Превышен лимит 5000 вариантов за одну загрузку.'); break; }
      if (!v || !identifier(v.id) || !identifier(v.product_id) || String(v.product_id) !== String(p.id)) { issue(row, 'variant', 'Некорректная принадлежность варианта товару.'); continue; }
      const id = 'insales-' + String(v.id), sku = clean(v.sku);
      if (v.title != null && (typeof v.title !== 'string' || v.title.length > 200)) issue(row, 'name', 'Проверьте название варианта, до 200 символов.');
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(sku)) issue(row, 'sku', 'Проверьте артикул варианта.');
      if (seenIds.has(id) || seenSkus.has(sku)) issue(row, 'sku', 'Дубликат варианта или артикула.');
      seenIds.add(id); seenSkus.add(sku);
      let priceMinor = null;
      try { priceMinor = rublesToMinor(v.price); } catch { issue(row, 'price', 'Проверьте цену в рублях, до двух знаков после точки.'); }
      let stock = null;
      if (v.quantity != null && v.quantity !== '') {
        const quantity = typeof v.quantity === 'number' || typeof v.quantity === 'string' ? String(v.quantity) : '';
        if (/^(0|[1-9]\d{0,8})(?:\.0+)?$/.test(quantity)) stock = Number(quantity);
        else issue(row, 'stock', 'Остаток для штучного товара должен быть целым и неотрицательным.');
      }
      const availability = stock === 0 ? 'out_of_stock' : stock > 0 && p.available === true && v.available === true ? 'in_stock' : 'unknown';
      products.push({ id, sku, name: [clean(p.title), clean(v.title)].filter(Boolean).join(' · '), category, manufacturer, unit,
        state: 'draft', oem: [], compatibility: [], priceMinor, stock, availability,
        sourceRef: 'insales:product:' + String(p.id) + ':variant:' + String(v.id), verifiedAt: null });
    }
  }
  const catalog = { version: 1, currency: 'RUB', products };
  if (!errors.length) { try { validateCatalog(catalog); } catch { issue(0, 'catalog', 'Данные не соответствуют модели каталога ROSEEN.'); } }
  return { ok: errors.length === 0, errors, catalog: errors.length ? null : catalog,
    summary: { sourceProducts: rows.length, drafts: errors.length ? 0 : products.length, published: 0 }, commitAllowed: false, checkoutEnabled: false };
}
