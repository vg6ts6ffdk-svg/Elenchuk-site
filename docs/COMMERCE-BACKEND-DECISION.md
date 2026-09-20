# ADR — commerce backend candidates (20 September 2026)

Status: recommendation prepared; provider is NOT connected and no account/paid plan is created.

## Fastest safe path
Keep the existing ROSEEN frontend/Express API and use a provider as the source of truth instead of rebuilding inventory/order administration from scratch.

### Candidate A — inSales (preferred for fastest full commerce launch)
Why: its official API exposes products/categories/orders, the platform has admin/catalog/import/stock/delivery/payment features, webhooks, and is designed for an external server integration. ROSEEN can keep its own branded frontend and synchronize through a server-side adapter.

Constraints: API credentials and an inSales account are required; current documentation states a 500 requests / 5 minutes limit. Do not expose API credentials to the browser.

### Candidate B — МойСклад (preferred if inventory/ERP is the priority)
Why: official JSON API can update product catalogue, prices/stock and receive orders from a custom site. This is a strong source of truth for inventory and B2B operations.

Constraint: it is not by itself the complete ROSEEN storefront/payment/fiscalization stack, so more custom order/checkout integration remains.

### Payments — ЮKassa, only after owner approval
Official API supports server-side payment creation, idempotence keys, refunds and incoming notifications. Payment status must be verified server-side; a browser return URL is not proof of payment. Provider is NOT selected by this ADR.

## Recommendation
For minimum time-to-market: **inSales as commerce backend + existing ROSEEN frontend**, with an optional later МойСклад integration if stock/accounting requires it. Payment/delivery/fiscalization are configured through approved providers only after seller/legal data are confirmed.

## What can be built before credentials
- provider-neutral adapter interface;
- catalogue import validation and dry-run;
- storefront/category/product/cart UI;
- order state machine and idempotency tests behind a disabled feature flag;
- admin mapping screens without secrets.

## Release gate
No production checkout until seller/legal/tax settings, real catalogue, backend account, payment/fiscalization, delivery, access control, backup/restore and sandbox E2E are verified.

Sources reviewed 20 September 2026:
- https://www.insales.ru/collection/doc-rabota-s-api-i-prilozheniya
- https://api.insales.ru/
- https://dev.moysklad.ru/
- https://yookassa.ru/developers/api
- https://yookassa.ru/developers/using-api/webhooks
