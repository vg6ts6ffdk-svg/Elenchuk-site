/** Commerce adapter contract. No payment, inventory reservation or order storage here.
 * Invoke with trusted server-side catalogue data, never a client-supplied catalogue.
 */
export const LAUNCH_REQUIREMENTS = Object.freeze([
  'sellerVerified', 'catalogVerified', 'commerceBackendReady', 'persistentOrdersReady',
  'inventoryReservationReady', 'paymentsSandboxPassed', 'fiscalizationReady',
  'deliveryVerified', 'legalReviewComplete', 'accessControlTested',
  'backupRestoreTested', 'releaseQaPassed'
]);
const STATES = new Set(['draft', 'published', 'archived']);
const AVAILABILITY = new Set(['in_stock', 'out_of_stock', 'on_request', 'unknown']);
const COMPATIBILITY = new Set(['confirmed', 'incompatible', 'unknown']);
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const identifier = (x) => typeof x === 'string' && IDENTIFIER.test(x);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const text = (x) => typeof x === 'string' && x.trim().length > 0;
const norm = (x) => String(x ?? '').normalize('NFKC').trim().toLocaleLowerCase('ru');
const fail = (message) => { throw new TypeError(message); };

/** Validate an adapter snapshot; validation proves shape, not factual correctness. */
export function validateCatalog(catalog) {
  if (!catalog || catalog.version !== 1 || catalog.currency !== 'RUB' || !Array.isArray(catalog.products)) fail('Invalid catalogue envelope');
  const ids = new Set(); const skus = new Set();
  for (const p of catalog.products) {
    if (!p || !identifier(p.id) || !identifier(p.sku)) fail('Invalid product identifier');
    if (ids.has(p.id) || skus.has(p.sku)) fail('Duplicate product id or SKU');
    ids.add(p.id); skus.add(p.sku);
    for (const key of ['name', 'category', 'manufacturer', 'unit']) if (!text(p[key])) fail(`Missing ${key}`);
    if (!STATES.has(p.state) || !AVAILABILITY.has(p.availability)) fail('Invalid publication or availability state');
    if (p.priceMinor !== null && (!Number.isSafeInteger(p.priceMinor) || p.priceMinor <= 0)) fail('Price must be positive integer kopecks or null');
    if (p.stock !== null && (!Number.isSafeInteger(p.stock) || p.stock < 0)) fail('Stock must be nonnegative integer or null');
    if (p.availability === 'in_stock' && !(p.stock > 0)) fail('In-stock product needs confirmed positive quantity');
    if (p.availability === 'out_of_stock' && p.stock !== 0) fail('Out-of-stock product must have zero quantity');
    if (!Array.isArray(p.oem) || !p.oem.every(text) || !Array.isArray(p.compatibility)) fail('OEM and compatibility must be arrays');
    if (p.state === 'published' && (!text(p.sourceRef) || !text(p.verifiedAt) || !Number.isFinite(Date.parse(p.verifiedAt)))) fail('Publication requires source and verification timestamp');
    const models = new Set();
    for (const c of p.compatibility) {
      if (!c || !text(c.equipmentBrand) || !text(c.model) || !COMPATIBILITY.has(c.status)) fail('Invalid compatibility record');
      if (c.revision != null && !text(c.revision)) fail('Invalid revision');
      const key = JSON.stringify([norm(c.equipmentBrand), norm(c.model), norm(c.revision)]);
      if (models.has(key)) fail('Duplicate compatibility scope');
      models.add(key);
      if (c.status !== 'unknown' && !text(c.sourceRef)) fail('A compatibility conclusion requires evidence');
    }
  }
  return catalog;
}

/** No transliteration or visual inference: unknown is not confirmed. */
export function compatibilityFor(product, equipment) {
  if (!product || !equipment || !text(equipment.brand) || !text(equipment.model)) return 'unknown';
  const modelRows = (product.compatibility ?? []).filter(c => norm(c.equipmentBrand) === norm(equipment.brand) && norm(c.model) === norm(equipment.model));
  // A known revision exception means an unspecified revision is not safe to match.
  if (!text(equipment.revision) && modelRows.some(c => text(c.revision))) return 'unknown';
  const exact = text(equipment.revision) ? modelRows.filter(c => norm(c.revision) === norm(equipment.revision)) : [];
  const rows = exact.length ? exact : modelRows.filter(c => !text(c.revision));
  if (!rows.length || rows.some(c => c.status === 'unknown')) return 'unknown';
  const statuses = new Set(rows.map(c => c.status));
  return statuses.size === 1 ? rows[0].status : 'unknown';
}

export function searchCatalog(catalog, options = {}) {
  validateCatalog(catalog);
  const { query = '', category = '', equipment = null } = options;
  const terms = norm(query).split(/\s+/).filter(Boolean);
  return catalog.products.filter(p => {
    if (p.state !== 'published' || (category && p.category !== category)) return false;
    const haystack = norm([p.name, p.sku, p.manufacturer, ...p.oem].join(' '));
    if (!terms.every(t => haystack.includes(t))) return false;
    return !equipment || compatibilityFor(p, equipment) === 'confirmed';
  });
}

/** Returns a goods subtotal only. Never authorizes checkout or reserves stock.
 * submitted price/stock/total fields are deliberately ignored.
 */
export function quoteCart(catalog, submittedLines) {
  validateCatalog(catalog);
  if (!Array.isArray(submittedLines) || submittedLines.length > 100) fail('Invalid cart');
  const quantities = new Map();
  for (const line of submittedLines) {
    if (!line || !identifier(line.id) || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 99) fail('Invalid cart line');
    const quantity = (quantities.get(line.id) ?? 0) + line.quantity;
    if (quantity > 99) fail('Quantity limit exceeded');
    quantities.set(line.id, quantity);
  }
  const products = new Map(catalog.products.map(p => [p.id, p]));
  const lines = []; const issues = []; let subtotalMinor = 0;
  for (const [id, quantity] of quantities) {
    const p = products.get(id);
    if (!p || p.state !== 'published') { issues.push({ id, code: 'NOT_AVAILABLE' }); continue; }
    if (p.priceMinor === null) { issues.push({ id, code: 'PRICE_ON_REQUEST' }); continue; }
    if (p.availability !== 'in_stock' || p.stock < quantity) { issues.push({ id, code: 'STOCK_UNCONFIRMED_OR_INSUFFICIENT' }); continue; }
    const totalMinor = p.priceMinor * quantity;
    if (!Number.isSafeInteger(totalMinor) || !Number.isSafeInteger(subtotalMinor + totalMinor)) fail('Amount exceeds safe integer range');
    subtotalMinor += totalMinor;
    lines.push({ id, sku: p.sku, quantity, unitPriceMinor: p.priceMinor, totalMinor });
  }
  return { currency: 'RUB', lines, issues, subtotalMinor: issues.length ? null : subtotalMinor, goodsReady: lines.length > 0 && issues.length === 0, excludes: ['delivery', 'tax_adjustments', 'discounts'], checkoutAuthorized: false };
}

/** Server-side release gate; a browser may not override these approvals. */
export function evaluateLaunchReadiness(approvals = {}) {
  const record = approvals && typeof approvals === 'object' ? approvals : {};
  const blockers = LAUNCH_REQUIREMENTS.filter(k => !own(record, k) || record[k] !== true);
  return { checkoutEnabled: blockers.length === 0, blockers };
}
