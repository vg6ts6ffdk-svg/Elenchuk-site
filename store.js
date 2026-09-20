import { CART_KEY, cleanCart, readCart, writeCart, parseSearch, selectProducts, formatPrice, serviceLink, availabilityLabel, validatePublicData } from './store-core.js';
const $ = id => document.getElementById(id);
const node = (tag, text = '', className = '') => { const el = document.createElement(tag); el.textContent = text; if (className) el.className = className; return el; };
const link = (text, href, cls = '') => { const el = node('a', text, cls); el.href = href; return el; };
let storage;
try { storage = window.localStorage; } catch { /* A memory-only cart still works. */ }
let cart = readCart(storage), data;
let quoteAbort, quoteVersion = 0;
function badge() { const quantity = cart.reduce((sum, l) => sum + l.quantity, 0); document.querySelectorAll('[data-cart-count]').forEach(el => { el.textContent = String(quantity); }); }
function save() {
  const persistent = writeCart(storage, cart);
  if (!persistent) {
    const warning = $('cart-storage-warning');
    if (warning) { warning.hidden = false; warning.textContent = 'Браузер не разрешает сохранение. Корзина доступна только на этой открытой странице.'; }
  }
  badge(); return persistent;
}
badge();
addEventListener('storage', event => { if (event.key === CART_KEY || event.key === null) { cart = readCart(storage); badge(); if (data && $('cart-lines')) renderCart(); } });
// Context goes into existing visible fields, never a new API contract or hidden PII.
const context = new URLSearchParams(location.search);
if (['selection', 'installation'].includes(context.get('requestMode'))) {
  const form = document.querySelector('#request-form');
  const sku = (context.get('serviceSku') || '').slice(0, 128);
  const equipment = (context.get('equipment') || '').slice(0, 180);
  if (form) {
    const model = form.querySelector('[name=model]'), problem = form.querySelector('[name=problem]');
    if (model && !model.value.trim()) model.value = equipment;
    if (problem && !problem.value.trim()) problem.value = [context.get('requestMode') === 'installation' ? 'Нужна установка запчасти.' : 'Нужен подбор и проверка совместимости.', sku && `Артикул / запрос: ${sku}`, equipment && `Оборудование: ${equipment}`].filter(Boolean).join('\n');
  }
}
function productCard(p) {
  const article = node('article', '', 'product-card'), a = link('', p.url, 'product-link');
  if (p.image) { const img = document.createElement('img'); img.src = p.image; img.alt = p.name; img.width = 640; img.height = 480; img.loading = 'lazy'; a.append(img); }
  else a.append(node('div', 'Фото товара не добавлено', 'product-no-image'));
  a.append(node('span', p.sku, 'product-sku'), node('h3', p.name));
  article.append(a, node('p', p.manufacturer, 'product-maker'), node('span', availabilityLabel(p.availability), 'product-availability'), node('strong', formatPrice(p.priceMinor), 'product-price'), node('span', `за ${p.unit}`, 'product-unit'), link('Характеристики и подбор ↗', p.url, 'product-details'));
  return article;
}
function equipmentText(state) { return [state.equipmentBrand, state.model, state.revision].filter(Boolean).join(' / '); }
function updateCatalog() {
  const form = $('catalog-search'); if (!form || !data) return;
  const params = new URLSearchParams(location.search);
  const defaultCategory = $('catalog')?.dataset.category || '';
  if (!params.has('category') && defaultCategory) params.set('category', defaultCategory);
  const state = parseSearch(params);
  for (const field of form.elements) if (field.name) field.value = params.get(field.name) ?? (field.name === 'sort' ? 'name' : '');
  if (state.equipmentBrand || state.model || state.revision || state.availability || state.manufacturer || params.has('min') || params.has('max')) form.querySelector('details').open = true;
  const result = selectProducts(data.products, state), results = $('catalog-results');
  $('catalog-count').textContent = `${result.total} позиций${result.total ? ` · страница ${result.page} из ${result.pageCount}` : ''}`;
  results.replaceChildren(...result.products.map(productCard));
  if (!result.total) {
    const panel = node('div', '', 'store-empty');
    const hasCatalog = data.products.length > 0;
    panel.append(node('span', '↗', 'store-empty-mark'), node('h2', hasCatalog ? 'Подходящие товары не найдены.' : 'Проверенные товары ещё не добавлены.'), node('p', hasCatalog ? 'Измените фильтры или передайте запрос инженеру. Отсутствие результата не означает, что деталь не существует.' : 'Артикулы, цены и совместимость проходят проверку перед публикацией. Можно передать модель оборудования и задачу инженеру.'), link('Запросить подбор ↗', serviceLink({ sku: state.q, equipment: equipmentText(state) }), 'btn btn-primary'));
    results.append(panel);
  }
  const pagination = $('catalog-pagination'); pagination.replaceChildren();
  if (result.pageCount > 1) {
    const pages = new Set([1, result.pageCount, result.page - 1, result.page, result.page + 1].filter(p => p > 0 && p <= result.pageCount));
    [...pages].sort((a, b) => a - b).forEach(number => { const p = new URLSearchParams(params); p.set('page', number); const a = link(String(number), `${location.pathname}?${p}#catalog`); a.dataset.catalogPage = String(number); a.setAttribute('aria-label', `Страница ${number}`); if (number === result.page) a.setAttribute('aria-current', 'page'); pagination.append(a); });
  }
}
function changeQuery(params) { history.pushState(null, '', `${location.pathname}${params.size ? '?' + params : ''}#catalog`); updateCatalog(); }
$('catalog-search')?.addEventListener('submit', event => {
  event.preventDefault(); const params = new URLSearchParams(new FormData(event.currentTarget));
  for (const [key, value] of [...params]) if (!value.trim()) params.delete(key);
  params.delete('page'); changeQuery(params);
});
$('sort')?.addEventListener('change', () => $('catalog-search').requestSubmit());
$('catalog-pagination')?.addEventListener('click', event => { const a = event.target.closest('a[data-catalog-page]'); if (!a) return; event.preventDefault(); changeQuery(new URL(a.href).searchParams); });
addEventListener('popstate', updateCatalog);
function renderCart() {
  const list = $('cart-lines'); if (!list || !data) return;
  list.replaceChildren();
  if (!cart.length) { const empty = node('div', '', 'store-empty'); empty.append(node('h2', 'Корзина пока пуста.'), node('p', 'Выберите товары в каталоге или запросите подбор детали.'), link('Открыть каталог ↗', 'shop.html', 'btn btn-primary')); list.append(empty); }
  cart.forEach(line => {
    const p = data.products.find(p => p.id === line.id), row = node('article', '', 'cart-row'), info = node('div'), controls = node('div');
    const title = node('h2'); title.append(p ? link(p.name, p.url) : node('span', 'Товар больше недоступен'));
    info.append(title, node('p', p ? `Артикул ${p.sku}` : `ID ${line.id}`), node('p', p ? `${formatPrice(p.priceMinor)} за ${p.unit} · ${availabilityLabel(p.availability)}` : 'Удалите позицию или уточните замену.'));
    const remove = node('button', 'Удалить'); remove.type = 'button'; remove.dataset.removeCart = line.id; remove.setAttribute('aria-label', `Удалить ${p?.name || line.id}`); info.append(remove);
    const id = 'quantity-' + line.id, label = node('label', 'Количество'); label.htmlFor = id;
    const input = node('input'); input.type = 'number'; input.id = id; input.min = '1'; input.max = '99'; input.value = line.quantity; input.dataset.cartQuantity = line.id;
    controls.append(label, input); row.append(info, controls); list.append(row);
  });
  checkQuote();
}
async function checkQuote() {
  const version = ++quoteVersion; quoteAbort?.abort();
  if (!cart.length) { $('cart-subtotal').textContent = '—'; $('cart-quote-status').textContent = 'Товары ещё не выбраны.'; return; }
  $('cart-subtotal').textContent = '—'; $('cart-quote-status').textContent = 'Проверяем стоимость и наличие…';
  const controller = new AbortController(); quoteAbort = controller; const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('/api/store/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lines: cart }), signal: controller.signal });
    if (!response.ok) throw new Error('Quote unavailable');
    const quote = await response.json(); if (version !== quoteVersion) return;
    if (quote.checkoutAuthorized !== false || quote.currency !== 'RUB' || !Array.isArray(quote.issues)) throw new Error('Invalid quote');
    if (quote.issues.length || !quote.goodsReady) { $('cart-quote-status').textContent = 'Состав требует уточнения: цена или наличие некоторых позиций не подтверждены. Итог не рассчитан.'; return; }
    if (!Number.isSafeInteger(quote.subtotalMinor) || quote.subtotalMinor <= 0) throw new Error('Invalid amount');
    $('cart-subtotal').textContent = formatPrice(quote.subtotalMinor);
    $('cart-quote-status').textContent = 'Стоимость товаров проверена по текущим данным каталога. Остатки не зарезервированы. Это не итог к оплате.';
  } catch { if (version === quoteVersion) $('cart-quote-status').textContent = 'Сервис расчёта недоступен. Корзина сохранена; цена и наличие не подтверждены.'; }
  finally { clearTimeout(timeout); }
}
$('cart-lines')?.addEventListener('click', event => { const button = event.target.closest('[data-remove-cart]'); if (!button) return; cart = cart.filter(l => l.id !== button.dataset.removeCart); save(); renderCart(); });
$('cart-lines')?.addEventListener('change', event => {
  const input = event.target.closest('[data-cart-quantity]'); if (!input) return;
  const line = cart.find(l => l.id === input.dataset.cartQuantity), quantity = Number(input.value);
  if (!line) return;
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) { input.value = line.quantity; input.setCustomValidity('Введите целое количество от 1 до 99'); input.reportValidity(); return; }
  input.setCustomValidity(''); line.quantity = quantity; save(); checkQuote();
});
document.querySelectorAll('[data-add-cart]').forEach(button => button.addEventListener('click', () => {
  const p = data?.products.find(p => p.id === button.dataset.addCart), input = $('product-quantity'), quantity = Number(input?.value), status = $('product-status');
  if (!p || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99 || p.priceMinor === null || p.availability !== 'in_stock') { if (status) status.textContent = 'Проверьте количество и наличие товара.'; return; }
  const current = cart.find(l => l.id === p.id), total = (current?.quantity || 0) + quantity;
  if (total > Math.min(p.stock, 99)) { status.textContent = 'Количество превышает доступный остаток по данным каталога.'; return; }
  if (current) current.quantity = total; else cart.push({ id: p.id, quantity });
  cart = cleanCart(cart); const persistent = save();
  status.replaceChildren(node('span', persistent ? 'Товар добавлен. ' : 'Товар добавлен только на этой странице: сохранение в браузере недоступно. '), link('Открыть корзину', 'cart.html'));
}));
async function init() {
  if (!$('catalog-search') && !$('cart-lines') && !document.querySelector('[data-add-cart]')) return;
  try { const response = await fetch('store-data.json', { cache: 'no-store' }); if (!response.ok) throw new Error('Catalogue unavailable'); data = validatePublicData(await response.json()); document.querySelectorAll('[data-add-cart]').forEach(button => { button.disabled = !data.products.some(p => p.id === button.dataset.addCart); }); updateCatalog(); renderCart(); }
  catch { const target = $('catalog-count') || $('cart-quote-status') || $('product-status'); if (target) target.textContent = 'Не удалось обновить каталог. Повторите позже или запросите подбор в сервисе.'; }
}
init();
