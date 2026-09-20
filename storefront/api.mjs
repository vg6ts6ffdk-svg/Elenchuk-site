import { Router } from 'express';
import { quoteCart } from '../commerce/catalog.mjs';
import { storefrontEnabled, readCatalog, publicCatalog } from './settings.mjs';
import { rateLimit } from '../security.mjs';
/** Read-only preview router. It never initializes service DB or creates orders. */
export function createStoreRouter({ enabled = storefrontEnabled, load = readCatalog } = {}) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); if (!enabled()) return res.status(404).json({ error: 'Маршрут не найден' }); next(); });
  router.get('/catalog', (_req, res) => res.json(publicCatalog(load())));
  router.post('/quote', rateLimit(60, 60000), (req, res) => {
    try { res.json({ ...quoteCart(load(), req.body?.lines), mode: 'preview', checkoutEnabled: false }); }
    catch (e) { if (e instanceof TypeError) return res.status(400).json({ error: 'Проверьте состав и количество товаров' }); throw e; }
  });
  router.use((_req, res) => res.status(404).json({ error: 'Заказы и оплата в этой версии не подключены' }));
  return router;
}
