# inSales connection and draft import - 4 October 2026

Baseline: `d6bd4c87dba18e7dea9a5ee21f698afd8aad708f`, current main confirmed through GitHub. Branch: `feat/insales-catalog-ready-20261004`. The previously prepared catalogue reader was transferred onto the current site without restoring the retired household service direction or replacing any public page.

The server-only connector now has authenticated connection-check and draft-import endpoints under `/api/store-admin/insales/`. Configuration presence remains separate from successful product-read verification. The API and private CLI share bounded loading and explicit mapping validation. Source requests are GET-only, redirect-blocked and capped by response size and time; rejected bodies are cancelled. Loading is limited to 5000 products/variants, 16 MB and 30 seconds. Final review corrected variant counting to include every incoming variant, including invalid and hidden records, before pagination and validation can allocate a large error report. Provider operations share a five-per-five-minute limit and a single-operation guard per process. Preview responses contain at most 100 rows/errors, never source descriptions, costs or credentials. All imported rows remain drafts and checkout stays disabled.

Validation on Node 22.23.3: **117/117 tests passed**, zero failures/skips. The tests exercise admin denial, missing/invalid credentials, provider errors and retry delays, malformed data, exact kopecks, unknown stock, duplicate pagination, response-size/time/total-input-variant limits, concurrent loads, secret-field exclusion, private output and the disabled publication/payment boundary. Source check: 31 pages / 1052 references. Public build: 64 allowlisted files. Built-site check: 31 pages / 1390 references. SHA-256 comparison confirmed that the entire public output exactly matches the already released site; there are no UI changes, new public products or exposed integration files. Existing main browser QA run 37175340767 completed successfully. Current-head CI browser results and deployment evidence are recorded in the release PR; no physical-device check is claimed.

Publication of the earlier inSales implementation was rejected by automatic approval review because trusted repository status and explicit permission to publish that content had not been established. The current GitHub connection has confirmed admin/push rights to the owner's repository, and the owner explicitly approved publication of this checked integration on 4 October 2026. Publication proceeds through a feature PR, required checks and an exact-head merge; release evidence is recorded in that PR after deployment. This approval does not configure a provider account, accept its terms or enable checkout. The separately approved service-removal release is already live.

The inSales tab still shows a combined login/registration form. Its code-request button accepts the provider's terms, so account access remains a user-owned step. No real account credentials, seller record, catalogue, prices or stock have been verified. Orders, reservations, payments, fiscalization, delivery and customer-account integration remain incomplete. This is a checked connection/import implementation, not a running transactional store. See `docs/INSALES-SETUP.md`.

---

# Remove household appliance service - 4 October 2026

Baseline: `5a327e6ac5d13d92d3796bacb526ad56460acc7e`. The owner confirmed that ROSEEN does not service household appliances. Removed that direction from all public navigation, homepage/direction cards, service request choices, company/FAQ copy, search/social descriptions and sitemap. The active profile is robotics, electronics and professional equipment. Replaced the household service illustration with a service robot and removed the two unused image exports from the public build. Three direction cards now share one desktop row, horizontal cards on intermediate widths and a stacked layout through 800px. PR review caught a cramped 541–800px range in the initial CSS; the explicit 800px override fixes it, and existing browser QA now includes homepage/directions captures at 541, 800 and 1024px alongside 320, 390, 768 and 1440px. That added coverage also exposed horizontal overflow in the homepage's three process labels at 541px; they now use the existing vertical mobile presentation through 800px. The inspected direction screenshots are readable at 541px and 1440px; final browser checks must pass for the corrected commit before release.

The old `appliances.html` address remains a noindex redirect to `directions.html` for static hosting, with HTTP 301 on the Express host. It contains no service offer or form. Historical internal notes and existing customer request records are preserved. The current brief and README now describe the owner's confirmed scope. Existing brand QA waits for the legacy redirect; the source-branding test now expects 14 full service shells rather than the former 15.

Local validation: 80/80 tests passed under supported Node 22; source check passed (31 pages / 1052 references); production public build passed (64 public files); built-site check passed (31 pages / 1390 references). A compiled-content audit covered all 31 HTML pages, catalogue data and sitemap: no household offer, menu/form option, retired illustration or sitemap URL remains. An isolated Express check confirmed HTTP 301, successful navigation to current directions and 404 responses for both retired images. Local Playwright browser download was truncated by the execution environment, so Chromium/WebKit layout, menu and form checks are required in CI before merging. Exact commit checks, browser review and live-domain observations will be recorded in the release PR; this entry does not claim publication.

---

# Refined blue edge light - 4 October 2026

Baseline: `1f124c406fa105805615cf1df0a1909294fd7b1a`. The owner clarified that blue edge light should remain because it adds depth; the previous removal was an interpretation error. Primary R and EE now have restrained blue light, a precise rim and subtle dark face shading. The approved glyph paths remain exact; uniform sizing improves prominence while preserving padding. Layered native vector strokes represent the soft light, preserving print quality without rasterising the icon page. Web exports and brandbook 4.5 share the same artwork. Release evidence is recorded in the PR after checks and publication.

---

# Clean primary icons - 4 October 2026 (superseded interpretation)

Baseline: `31ccb2b677881aacb7506870acee2eb1b12fa9e2`. The assistant interpreted a comment about the blue illuminated edges as a request to remove them; the owner subsequently clarified the opposite. This superseded 4.4 revision used one solid Graphite #16181D rounded surface without glow. The original glyph paths were unchanged and browser asset fingerprints refreshed from SVG/PNG bytes. Revision 4.5 restores and refines the light according to the owner's explicit correction.

---

# Primary icon set on the website - 4 October 2026 (superseded icon styling)

Baseline: `07edc342abc95d27bd968cc4edfc3da4d738c3ed`. Brandbook 4.3 now treats the owner's selected R and EE badges as the primary icon set. Their approved vector paths are preserved in the web assets. Browser tabs use a uniformly enlarged R with the same dark tile and blue glow, plus a 32px PNG fallback. iOS home-screen bookmarks use the badge rendered directly from vector at 180px. All source pages and generated storefront shells include the relevant links; production builds fingerprint PNG as well as SVG URLs so updated icons do not reuse stale cached resources.

The full graphical RU header and EN footer remain in their established roles. Asset sources and hashes are recorded in `assets/brand/manifest.json`. Existing Chromium/WebKit browser QA now decodes each linked icon and checks its declared dimensions. Release checks and deployed-domain observations are recorded in the PR; an emulated browser check does not claim a physical iPhone home-screen test.

---

# Visible touch motion and print reconstruction - 4 October 2026

Baseline: `f166d97e2cc2398cdba5f8b12e2ff2bf34f90989`. Owner reported imperceptible animations and unreadable brandbook pages. Mobile opacity effects previously completed 120px below the viewport and were cancelled on each touchmove. Reveals now begin inside the viewport, last 350ms and finish during swiping without any translation or layout change. Only the separate first-session brand tokens use a 0/180/360ms sequence. The reduced-motion replay control now states why animation is disabled. Fixed mobile navigation remains immediately tappable.

Added Chromium/WebKit regression for real active opacity during a swipe, below-viewport timing and final visible state, alongside existing menu-after-scroll and stationary-layout checks. Print source audit found 35 legacy pages embedded as 498x352px thumbnails; the owner's requested repair requires vector text/tables and improved photographic vehicle examples on pages 33/35. Print reconstruction and final publication evidence are recorded in the release PR after validation.

---

# Graphite palette and brandbook colours — 3 October 2026

Baseline: `8c12833edb66a7b8c7d8022705f56680d5b5b342`. Owner accepted graphite/white/silver with restrained corporate blue and asked to update the brandbook colours. Removed decorative blue rules in submenus, callout panels and store notices, neutralised secondary markers and replay text. Corporate blue remains in approved logo masters, primary CTA, active navigation and links; green is reserved for confirmed success. Theme colour and written master prompt now use the current palette, avoiding a return to navy/light surfaces.

Palette revision is 4.1; approved logo geometry is still 4.0. The existing 42-page restored brandbook is updated in place, with colour rules and digital applications revised. Its raster manufacturing/photo examples remain construction references; current colour specifications take priority. Site/browser and PDF visual validation results are recorded in the release PR.

---

# Mobile regression fix — 3 October 2026

Baseline: `bd0f27f078598e9721eb88744ceabf1a4e0cc77d`. Owner reported mobile jitter and missing navigation after the premium motion release. The previous layout QA did not cover opening the menu after scrolling.

Removed backdrop-filter from the fixed header: it established a containing block for the nested fixed menu, collapsing its viewport area after the header switched to its scrolled state. Header is opaque graphite; mobile header transitions and process-line drawing are disabled. Touch/narrow layouts now use one short 220ms opacity effect per content unit, without translation, nested child sequences or delays. Mobile scroll reveals start ahead of the viewport; touch movement cancels active effects. Navigation opens immediately without animations, and touch layouts use native scrolling.

Added Chromium/WebKit touch regressions at 320, 390, 768 and 844 landscape widths, across homepage, services, news and store: scroll before opening, full viewport menu bounds, actual link taps, close/scroll position retention, no navigation animation, no mobile content transforms/delays. Cache versions updated. Physical iPhone testing is not available in this environment. Local/CI checks and publication results are recorded in the fix PR before release.

---

# Premium motion refinement — 3 October 2026

Baseline: `875742e04f47e92ebb045e6e3550c19ed484eae3` (main and Vercel production at start). Owner requested a premium Apple-like presentation on the existing site; graphite surfaces and small blue brand accents remain.

Shared motion now gives section headings and supporting copy their own reading order; cards in a desktop row follow at 70ms intervals; direction visuals fade with a separate text entrance; process cards draw a quiet neutral line. The header uses graphite glass after scrolling. Buttons have a 1.5% hover response on fine pointers and immediate touch feedback; navigation underlines and neutral card highlights use short transitions. Mobile menu links enter in a short sequence. Content starts after DOM readiness rather than waiting for every image. Reduced-motion changes cancel effects, resume pending content when re-enabled, and bfcache restores observers. Every effect is finite; no continuous scroll transforms or robot disassembly.

Approved RU/EN logo geometry stays fixed; only the header's first-session opacity entry is permitted. No content is hidden by default. Shared asset URLs are versioned for mobile caches. Forms, APIs, catalogue and mail settings are unchanged.

Local source check, public build and 22-page/794-reference build validation passed. Local tests: 75 passed; the SQLite order-repository suite aborts in its native addon cleanup under the workspace Node 24 runtime. CI uses the project's supported Node 22; its complete results and browser QA are release gates. Added browser checks for reading-order headings, desktop row staggering, preference changes, stationary masters, and homepage layouts at 320/390/768/1024/1440px plus mobile WebKit. Preview and production observations are recorded in the PR after those checks, not assumed here.

---

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
# Quiet photographic background and 404 — 4 October 2026

Baseline: `9846db7c8f8d6b2607bb5e3437cc506da71b699d`, fetched current main. Branch: `fix/roseen-404-subtle-background-20261004`.

The owner's human/robot hand reference was restyled as a graphite AI illustration without watermarks. The 1536×1024 WebP weighs 54,480 bytes. Public page backgrounds show it at 5.5% opacity (3.5% on small screens), with a static mask and no fixed positioning or added animation. The 404 illustration is deliberately clearer and separated from its heading and recovery buttons. Graphical RU/EN logo masters are unchanged.

The 404 links and assets use root paths so unknown nested URLs do not break the page. Same-page skip navigation remains local. The public allowlist, cache hashing and link validator include the new asset and root paths; the 404 is marked noindex.

Local source validation, public builds and built-link validation passed: 22 service/news pages, plus the production public-storefront build (31 pages / 1,474 references). The 14 branding/source/master-geometry regression checks passed. Full local `npm test` was attempted but native SQLite loading failed in this workspace; rebuilding its native dependency also failed during header extraction. Local browser installation was attempted, but the browser download returned a truncated archive. Complete tests and browser acceptance are therefore verified through the PR's CI, with visual artifacts and release evidence attached to that exact commit. This entry does not claim those external checks have passed before their results arrive.

Scope is decorative presentation and recovery navigation. Service APIs, forms, catalogue data, checkout gates, mail, DNS and permissions are unchanged.

---
