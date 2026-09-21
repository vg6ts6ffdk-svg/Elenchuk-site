# Current execution status — 21 September 2026

The active integration branch is `consolidate/roseen-20260921`. See [CONSOLIDATION.md](CONSOLIDATION.md) for the source map, preserved decisions and exclusions. Main baseline: `7a244dc`; platform head included: `9c7c713`; rejected-logo cleanup: `4386676`; isolated CC1 experiments: `9c8d469`.

PR #3, #4 and #7 are already merged upstream. This consolidation does not merge anything into main or deploy production. PR #5 and #8 are preserved as source reviews, not deleted.

Implemented: multipage service; approved graphical RU header / EN footer / R favicon in raw sources and builds; brand motion; gated empty catalogue, categories, search, cart and server quote; admin CSV dry-run; account preview; standalone idempotent SQLite/PostgreSQL order repository. The order repository is **not wired into checkout**, and its PostgreSQL path still needs a real isolated-database test.

Not launched: real catalogue, checkout, payments, fiscalization, shipping, client authentication/order cabinet and provider integrations. No real orders, emails or payments are produced by consolidation tests. Do not infer present remote API health from the old 18 September Preview error.

CC1 source variants are retained in `prototypes/`, excluded from the public allowlist. They remain schematic experiments requiring separate review, not completed production animation.

Consolidation QA: a first test run caught a mismatch in the explicit eager-loading attribute after merging logo fixes; the attribute was restored without weakening the regression test. Final verification is recorded in the integration PR and local handoff. Browser and production readiness must not be inferred from a successful build.

## Historical snapshot — 20 September 2026 (superseded by the status above)

## Baseline and scope
- Audited main: `b01dda16e496c9053361ba5b4090f35273045988`.
- PR #7 branch before this increment: `5bd740d43acf18a87efd367cd805db361dc75d92`.
- Baseline source snapshot checkpoint: `118af628adea8ae0417b90f5a0a29b8f81bbf69c`.
- Vercel production matched main at the initial check. `roseen.ru` could not be independently fetched; no DNS changes made.

## Implemented by this increment (await browser QA before accepting)
- Retired unused page-template.html, which contained obsolete logos and a legacy form. No customer data was deleted.
- Replaced typed wordmark placeholders in raw HTML with references to the existing outlined master. Build resolves Russian header / English footer. SVG bytes unchanged.
- Opacity-only logo appearance, session-scoped RO/SE/EN; visible-by-default content reveal via WAAPI. Removed magnetic/parallax JS. Denied storage, absent observer and reduced motion use static content.
- Preview-only storefront: catalogue, six category URLs, guest cart; separate product pages generated only for actual published data records.
- Query/SKU/OEM, model/revision compatibility, category/manufacturer/stock/price filters, sorting, URL state and pagination.
- Cart stores only IDs and quantities, supports cross-tab refresh. Quote uses trusted catalogue on the server; no price supplied by a client is accepted. Checkout remains false, no orders or reservations.
- Context handoff to the existing service form uses bounded visible model/problem fields; no changes to its upload/API contract.
- Public data projection excludes internal source records. Committed catalogue is empty: no invented offers or demo products in Preview.
- Independent Platform v5 QA and reproducible source artifacts; synthetic products exist in tests only.

## Explicitly not implemented / not launched
No commerce platform selected, no real catalogue import/admin, persistent order engine, payment/fiscalization/shipping connectors, client registration, or customer order cabinet. Static product snapshots are not stock synchronization. Product specifications/media require actual source records before commercial publication. Current preview does not satisfy the full e-commerce acceptance criteria.

`VERCEL_ENV=preview` enables the storefront; local QA may use `ROSEEN_STOREFRONT_PREVIEW=1` outside production. Production cannot enable it via this local flag. No main merge, production release, DNS/mail settings, prices, account roles or existing database were changed.

## Next dependencies
Confirm seller/tax/legal context and real product catalogue (SKU, price, stock, compatibility evidence, media). Select commerce backend by a separate reviewed architecture decision; then implement admin import, persistent orders, account ownership, provider adapters and sandbox end-to-end checks. Existing development-only default credentials in service code must be removed in a separately tested hardening pass before extending authentication to customers; production already rejects its default secret/password.

## QA evidence
Use Platform v5 QA artifact report.json and Brandbook browser QA for this commit, not screenshots or results from earlier commits. CI screenshots include actual Inter loading checks. Browser emulation is not a physical iPhone test. No real service requests, emails or payments are sent by these tests.
