const ORDER_STATUSES=new Set(['draft','awaiting_payment','paid','fulfillment','completed','cancelled','refund_pending','refunded']);
const PAYMENT_STATUSES=new Set(['not_started','pending','succeeded','failed','cancelled','partially_refunded','refunded']);
const transitions={draft:new Set(['awaiting_payment','cancelled']),awaiting_payment:new Set(['paid','cancelled']),paid:new Set(['fulfillment','refund_pending']),fulfillment:new Set(['completed','refund_pending']),completed:new Set(['refund_pending']),refund_pending:new Set(['paid','refunded']),refunded:new Set([]),cancelled:new Set([])};
const clean=x=>typeof x==='string'?x.trim():'';
export function createOrderSnapshot({id,customerId=null,customerType='b2c',lines,currency='RUB',goodsSubtotalMinor,idempotencyKey}){
 if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id||''))throw new TypeError('Invalid order id');
 if(!['b2c','b2b'].includes(customerType))throw new TypeError('Invalid customer type');
 if(customerId!==null && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(customerId))throw new TypeError('Invalid customer id');
 if(currency!=='RUB'||!Number.isSafeInteger(goodsSubtotalMinor)||goodsSubtotalMinor<=0)throw new TypeError('Invalid order amount');
 if(!Array.isArray(lines)||!lines.length||lines.length>100)throw new TypeError('Invalid order lines');
 if(!/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey||''))throw new TypeError('Invalid idempotency key');
 const snapshot=lines.map(l=>{if(!l||typeof l.id!=='string'||!Number.isSafeInteger(l.quantity)||l.quantity<1||!Number.isSafeInteger(l.unitPriceMinor)||l.unitPriceMinor<=0)throw new TypeError('Invalid order line');const totalMinor=l.unitPriceMinor*l.quantity;if(!Number.isSafeInteger(totalMinor))throw new TypeError('Invalid order line amount');return Object.freeze({id:l.id,sku:clean(l.sku),name:clean(l.name),quantity:l.quantity,unitPriceMinor:l.unitPriceMinor,totalMinor});});
 const sum=snapshot.reduce((a,l)=>a+l.totalMinor,0);if(!Number.isSafeInteger(sum)||sum!==goodsSubtotalMinor)throw new TypeError('Order amount does not match line snapshot');
 return Object.freeze({id,customerId,customerType,currency,goodsSubtotalMinor,lines:Object.freeze(snapshot),status:'draft',paymentStatus:'not_started',idempotencyKey,createdAt:new Date().toISOString()});
}
export function transitionOrder(order,nextStatus){if(!order||!ORDER_STATUSES.has(order.status)||!ORDER_STATUSES.has(nextStatus))throw new TypeError('Invalid order status');if(!transitions[order.status]?.has(nextStatus))throw new TypeError('Order transition not allowed');return {...order,status:nextStatus};}
export function applyPaymentState(order,nextPaymentStatus,{verified=false}={}){if(!order||!PAYMENT_STATUSES.has(order.paymentStatus)||!PAYMENT_STATUSES.has(nextPaymentStatus))throw new TypeError('Invalid payment status');if(['succeeded','partially_refunded','refunded'].includes(nextPaymentStatus)&&verified!==true)throw new TypeError('Verified provider event required');return {...order,paymentStatus:nextPaymentStatus};}
export function canViewOrder(order,viewer){if(!order||!viewer)return false;if(viewer.role==='admin'||viewer.role==='store_manager')return true;return viewer.role==='customer'&&typeof viewer.customerId==='string'&&viewer.customerId===order.customerId;}
export {ORDER_STATUSES,PAYMENT_STATUSES};
