/* Pure storefront state. Client totals are estimates, never payment authority. */
const norm = x => String(x ?? '').normalize('NFKC').trim().toLocaleLowerCase('ru');
export const CART_KEY = 'roseen.cart.v1';
export const PAGE_SIZE = 12;
const sorts = new Set(['name', 'price-asc', 'price-desc']);
const availabilities = new Set(['', 'in_stock', 'on_request', 'out_of_stock', 'unknown']);
export const safeId = x => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(x);
export function cleanCart(value) {
  if (!Array.isArray(value) || value.length > 100) return [];
  const map = new Map();
  for (const line of value) {
    if (!line || !safeId(line.id) || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 99) continue;
    map.set(line.id, Math.min(99, (map.get(line.id) || 0) + line.quantity));
  }
  return [...map].map(([id, quantity]) => ({ id, quantity }));
}
export function readCart(storage) {
  try { return cleanCart(JSON.parse(storage.getItem(CART_KEY) || '[]')); } catch { return []; }
}
export function writeCart(storage, lines) {
  const clean = cleanCart(lines);
  try { storage.setItem(CART_KEY, JSON.stringify(clean)); return true; } catch { return false; }
}
export function priceFilter(value) {
  if (!/^[0-9]{1,9}(?:[.,][0-9]{1,2})?$/.test(value || '')) return null;
  const [r, k = ''] = value.replace(',', '.').split('.');
  return Number(r) * 100 + Number(k.padEnd(2, '0'));
}
export function parseSearch(params) {
  const str = k => String(params.get(k) || '').slice(0, 200).trim();
  return { q: str('q'), category: str('category'), manufacturer: str('manufacturer'), equipmentBrand: str('equipmentBrand'), model: str('model'), revision: str('revision'), availability: availabilities.has(str('availability')) ? str('availability') : '', min: priceFilter(str('min')), max: priceFilter(str('max')), sort: sorts.has(str('sort')) ? str('sort') : 'name', page: /^\d{1,6}$/.test(str('page')) ? Math.max(1, Number(str('page'))) : 1 };
}
export function compatibility(product, equipment) {
  if (!norm(equipment.equipmentBrand) || !norm(equipment.model)) return 'unknown';
  const rows = (product.compatibility || []).filter(c => norm(c.equipmentBrand) === norm(equipment.equipmentBrand) && norm(c.model) === norm(equipment.model));
  if (!norm(equipment.revision) && rows.some(c => norm(c.revision))) return 'unknown';
  const exact = norm(equipment.revision) ? rows.filter(c => norm(c.revision) === norm(equipment.revision)) : [];
  const scopes = exact.length ? exact : rows.filter(c => !norm(c.revision));
  const statuses = new Set(scopes.map(c => c.status));
  return statuses.size === 1 ? [...statuses][0] : 'unknown';
}
export function selectProducts(products, state) {
  const words = norm(state.q).split(/\s+/).filter(Boolean);
  const equipmentSelected = Boolean(norm(state.equipmentBrand) || norm(state.model) || norm(state.revision));
  let selected = products.filter(p => {
    const haystack = norm([p.name, p.sku, p.manufacturer, ...(p.oem || []), ...(p.compatibility || []).flatMap(c => [c.equipmentBrand, c.model])].join(' '));
    if (!words.every(w => haystack.includes(w))) return false;
    if (state.category && p.category !== state.category) return false;
    if (state.manufacturer && p.manufacturer !== state.manufacturer) return false;
    if (state.availability && p.availability !== state.availability) return false;
    if ((state.min !== null || state.max !== null) && p.priceMinor === null) return false;
    if (state.min !== null && p.priceMinor < state.min) return false;
    if (state.max !== null && p.priceMinor > state.max) return false;
    return !equipmentSelected || compatibility(p, state) === 'confirmed';
  });
  selected.sort((a, b) => {
    if (state.sort !== 'name') {
      if (a.priceMinor === null && b.priceMinor !== null) return 1;
      if (b.priceMinor === null && a.priceMinor !== null) return -1;
      if (a.priceMinor !== b.priceMinor) return (a.priceMinor - b.priceMinor) * (state.sort === 'price-desc' ? -1 : 1);
    }
    return a.name.localeCompare(b.name, 'ru') || a.id.localeCompare(b.id);
  });
  const total = selected.length, pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(state.page || 1, pageCount);
  return { products: selected.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total, page, pageCount };
}
export function formatPrice(value) {
  return value === null ? 'Цена по запросу' : new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: value % 100 ? 2 : 0 }).format(value / 100);
}
export function serviceLink({ sku = '', equipment = '', mode = 'selection' } = {}) {
  const p = new URLSearchParams({ requestMode: mode === 'installation' ? 'installation' : 'selection' });
  if (sku) p.set('serviceSku', String(sku).slice(0, 128));
  if (equipment) p.set('equipment', String(equipment).slice(0, 180));
  return `contacts.html?${p}#request`;
}
export const availabilityLabel = value => ({ in_stock: 'В наличии', out_of_stock: 'Нет в наличии', on_request: 'Поставка по запросу', unknown: 'Наличие уточняется' })[value] || 'Наличие уточняется';
export function validatePublicData(data) {
  if (!data || data.version !== 1 || data.currency !== 'RUB' || data.mode !== 'preview' || data.checkoutEnabled !== false || !Array.isArray(data.products) || !Array.isArray(data.categories)) throw new TypeError('Invalid public catalogue');
  const ids = new Set();
  for (const p of data.products) {
    if (!p || !safeId(p.id) || ids.has(p.id) || p.url !== `product-${p.id}.html` || typeof p.name !== 'string' || typeof p.sku !== 'string' || !Array.isArray(p.compatibility) || !Array.isArray(p.oem)) throw new TypeError('Invalid product');
    ids.add(p.id);
    if (p.priceMinor !== null && (!Number.isSafeInteger(p.priceMinor) || p.priceMinor <= 0)) throw new TypeError('Invalid price');
    if (p.image && !/^assets\/catalog\/[A-Za-z0-9_-]+\.(?:webp|png|jpg)$/.test(p.image)) throw new TypeError('Unsafe media');
  }
  return data;
}
