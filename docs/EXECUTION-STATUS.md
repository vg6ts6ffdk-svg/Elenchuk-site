# Graphite and section navigation — 3 October 2026

Current palette is graphite: the owner rejected the light workspace trial, and PR #26 restored dark news/store surfaces. This follow-up makes archive headlines white with blue hover/focus and builds current-section indicators into desktop/mobile navigation for news articles, store categories/products and service details. Indicators are available without JavaScript; exact-page and enclosing-section semantics remain distinct. Motion and logo masters are preserved.

Validation and publication evidence are recorded in the PR. Earlier light-theme notes below describe the superseded trial.

# Light working surfaces — 3 October 2026

Baseline: `1a171eaa34a17e34cb23dd8f6a73c816b1471bb6`. Owner accepted trying light working surfaces for news and catalogue. News/archive/articles and storefront/category/cart/account main areas use Cloud #F1F5F9, white cards, Deep Navy #0F172A text, Slate #475569 secondary text and readable blue #1D4ED8 links/focus. The graphite service pages and dark header/footer remain. Existing light logo masters stay on their approved dark header/footer surfaces.

Store text/link/placeholder colors now follow contextual tokens instead of fixed white/pale-blue values. Primary blue CTA keeps navy text. CSS URLs versioned for refresh. Existing motion, navigation, forms and commerce gates are preserved; CC1 remains deferred. QA/release evidence is recorded in the PR.

---

# Neutral colour balance — 3 October 2026

Baseline: `bd21b4cfd338617b3c37f3a75e9d162083b044a1`. Owner requested less blue and explicitly deferred CC1 disassembly. Large backgrounds/cards/inputs now use neutral graphite; large emphasized headings and section numbers are white/grey. Corporate blue remains in approved logo masters, descriptor initials, primary service CTA, active navigation and focus states. The desktop header CTA is now a neutral outline, avoiding two competing blue buttons on the first screen. News follows shared tokens; store/categories/cart/account replace hardcoded navy surfaces with the same neutral tokens. CSS URLs are versioned to refresh mobile caches.

Approved SVGs, page structure, copy, animation and service/commerce behavior are unchanged. CC1 disassembly is deferred, not a release dependency. Validation and Preview/production evidence are recorded in the PR.

---

# Site-wide motion — 3 October 2026

Baseline: `a2fef64b4cf1f8de56117b82907cfd81bf80c6ae`. Shared progressive motion now covers service headings, cards, steps, forms, FAQ, news articles and the storefront/categories/cart/account. Each content unit appears once per visit: opacity and 10px/250ms on mobile, 14px/320ms on desktop, short row staggering. Images fade without transforms. FAQ and mobile-menu opening use a 180ms fade. The existing home first-session RO/С/ИН composition and replay remain; header/logo masters and footer geometry are untouched.

All content remains visible without JS, observer or storage. Reduced motion cancels active effects and disables decorative openings. Focus cancels an effect containing the focused control. Dynamically loaded product cards share the same reveal; input values and live status messages are not animation targets. No parallax, loops or blocking preload.

Past discussion: uniform scroll appearances across pages and mobile were agreed. The later CC1 direction is an unobtrusive large-part disassembly/assembly on Robotics, without board labels or invented internals. Existing schematic prototypes remain excluded from production pending geometry review; this release does not claim that robot effect is finished.

Local validation: source check passed; 79/79 tests passed; public build passed; 30 pages and 1362 references checked. Browser QA runs in CI (Playwright is not installed in the local repository). Release evidence is recorded in the PR. No production requests, messages, transactions or catalogue data changes are made by motion QA.

---

# Service audit follow-up — 3 October 2026

Baseline: `7bfaed1f66980894185c06eddb156c63465a925b` (current main and Vercel production at start). No open PRs at start. This change is built from main; no historical branch is used.

Changes: model-specific diagnostic copy on robotics/electronics/appliances pages; search titles; expanded service FAQ; latest news card; nearby AI illustration labels; useful catalogue selection state; public account copy without developer terminology; optional HTTPS video link folded into the existing problem field; immediate file-size/count feedback; unchanged upload limits and API contract.

Local checks: source validation; 79/79 tests including isolated SQLite service request + attachment persistence and protected admin retrieval; public build; 30 pages and 1362 local references verified. Tests required network/server sandbox escalation; the initial restricted run could not run the three server suites. No production requests, customer messages or payments created.

Read-only production health: `https://api.roseen.ru/api/health` returned 200, `ok:true`, PostgreSQL and object storage. `https://elenchuk-site.vercel.app/api/health` returned 503. The roseen.ru build uses api.roseen.ru; Vercel uses its own origin. Health alone is not proof of production request delivery or employee notifications. Existing code saves requests; it does not implement outbound employee notification delivery.

Remaining external dependencies: authorised secure sign-in is needed to read the Karex catalogue (current browser shows the login form); no real catalogue rows were obtained. Public ROSEEN phone/address/legal seller, SLA/prices/warranty and cases are not confirmed. Corporate mailbox delivery is not verified. No substitute contacts or invented offers were published. Checkout and customer login remain gated per the master assignment pending verified seller/catalogue/providers and isolated E2E. Vercel backend configuration needs correction through authorised configuration access. DNS, mail, permissions and production data were not changed.

Release gate: CI browser checks and Preview/production observation recorded in the PR and final handoff; this entry alone does not claim they passed or that the full store launched.

---
# News section — 29 September 2026

Weekly briefing publication shipped in PR #12 (407dc12), verified on roseen.ru. The follow-up renames the public section and menu to «Новости» at `news.html`, preserves the article URL and redirects `briefings.html`. The existing weekly ChatGPT automation is the publisher; repository documentation does not start an agent. This change does not alter commerce readiness or service APIs. Release checks and production verification are recorded in the follow-up PR.

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

## News archive addition — 3 October 2026

Added the 14–21 September briefing as `briefing-2026-09-21.html`, below the newer issue in Новости. Original issue and actual website publication dates are separate. Sources distinguish supplier claims, planned support and contracted units from independently measured results. Publication follows the verified PR and Pages workflow; this note alone is not deployment evidence.

## News editorial rule — 3 October 2026

Removed the regional-applicability and practical-check sections from both published briefings at the owner’s request. Future website issues omit these blocks; the publication guide and existing weekly automation carry the rule. News facts, source links and article URLs are preserved.
