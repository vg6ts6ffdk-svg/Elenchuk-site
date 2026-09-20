/** Provider-neutral commerce backend contract.
 * No secrets, network calls or production provider selection live in this module.
 */
export const CAPABILITIES = Object.freeze([
  'catalog.read','catalog.write','inventory.read','orders.write','orders.read','webhooks'
]);

export function assertCommerceAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object') throw new TypeError('Commerce adapter is required');
  for (const method of ['listProducts','getProduct','getInventory','createOrder','getOrder']) {
    if (typeof adapter[method] !== 'function') throw new TypeError('Missing commerce adapter method: '+method);
  }
  return adapter;
}

export function disabledCommerceAdapter(reason='Commerce backend is not configured') {
  const stop = async () => { const e=new Error(reason); e.code='COMMERCE_BACKEND_DISABLED'; throw e; };
  return Object.freeze({
    capabilities: [],
    listProducts: stop,
    getProduct: stop,
    getInventory: stop,
    createOrder: stop,
    getOrder: stop
  });
}
