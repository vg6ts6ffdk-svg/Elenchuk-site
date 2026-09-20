import fs from 'node:fs';
import { validateCatalog } from '../commerce/catalog.mjs';
export const categories = Object.freeze([
  { id: 'belts', name: 'Ремни и приводы', detail: 'Подбор по артикулу и параметрам узла' },
  { id: 'brushes', name: 'Щётки и пады', detail: 'Рабочие элементы уборочного оборудования' },
  { id: 'filters', name: 'Фильтры и расходники', detail: 'Компоненты регулярного обслуживания' },
  { id: 'electronics', name: 'Платы и модули', detail: 'Электроника и блоки управления' },
  { id: 'sensors', name: 'Датчики', detail: 'Контроль и навигация оборудования' },
  { id: 'service-kits', name: 'Сервисные комплекты', detail: 'Наборы для обслуживания и ремонта' }
]);
export function storefrontEnabled(env = process.env) {
  // No production override. Commercial launch requires a separate reviewed change.
  return env.VERCEL_ENV === 'preview' || (env.NODE_ENV !== 'production' && env.ROSEEN_STOREFRONT_PREVIEW === '1');
}
export function readCatalog() {
  const data = JSON.parse(fs.readFileSync(new URL('./catalog.json', import.meta.url), 'utf8'));
  validateCatalog(data);
  for (const p of data.products.filter(p => p.state === 'published')) {
    if (!categories.some(c => c.id === p.category)) throw new TypeError('Unknown storefront category');
    // Images are optional; do not manufacture a photo or accept an arbitrary URL.
    if (p.image != null) {
      if (typeof p.image !== 'string' || !/^assets\/catalog\/[A-Za-z0-9_-]+\.(?:webp|png|jpg)$/.test(p.image)) throw new TypeError('Unsafe catalogue image');
      if (!fs.existsSync(new URL('../' + p.image, import.meta.url))) throw new TypeError('Catalogue image missing');
    }
  }
  return data;
}
export const productPage = p => `product-${p.id}.html`;
export const categoryPage = id => `shop-${id}.html`;
export function publicCatalog(catalog = readCatalog()) {
  return {
    version: 1, currency: 'RUB', mode: 'preview', checkoutEnabled: false, categories,
    products: catalog.products.filter(p => p.state === 'published').map(p => ({
      id: p.id, sku: p.sku, name: p.name, category: p.category, manufacturer: p.manufacturer, unit: p.unit,
      oem: p.oem, priceMinor: p.priceMinor, stock: p.stock, availability: p.availability,
      url: productPage(p), image: p.image || null, description: typeof p.description === 'string' ? p.description.slice(0, 5000) : '',
      compatibility: p.compatibility.map(c => ({ equipmentBrand: c.equipmentBrand, model: c.model, revision: c.revision || null, status: c.status }))
    }))
  };
}
export function storePageNames() {
  return ['shop.html', 'cart.html', ...categories.map(c => categoryPage(c.id)), ...publicCatalog().products.map(p => p.url)];
}
export function storeMediaFiles() { return [...new Set(publicCatalog().products.map(p => p.image).filter(Boolean))]; }
