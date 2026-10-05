# ROSEEN execution contract

Read `docs/ROSEEN-MASTER-PROMPT.md` before changing this project. The visual source is the latest ROSEEN_Brandbook_5_0.pdf and the approved original logo masters. Later explicit owner decisions take priority.

- Preserve current functionality. Work from current main in a feature branch; no force-push or blind overwrites.
- Header: approved Cyrillic graphical РОСИН. Footer: approved graphical ROSEEN. Never substitute a typed wordmark. Preserve legitimate brand names in prose, alt, metadata and legal text.
- Preserve SVG geometry and existing masters. No regenerated logos, font files in downloadable brand kits, fake products/prices/stock, fake orders or payments.
- Commerce is gated until seller, data and real providers are verified. `commerce/catalog.mjs` is only an adapter contract; it is not an order/payment backend.
- Household-appliance repair is excluded by the owner (4 October 2026), including offers, forms and metadata. Old URLs may redirect to current directions, not restore the service. Company requisites and cases are excluded from the current technical scope.
- Motion follows the 5 October refinement: 600ms gradual content opacity, no mobile translation; 600ms header-logo opacity, static footer, no effects with reduced motion. Do not restore the old 350ms content timing from the PDF.
- Run `npm run check`, `npm test`, `npm run build`, `node scripts/check-site.mjs dist` and browser QA for UI changes. Report what actually ran.
- Do not publish unfinished checkout, charge money, send customer messages, change DNS/mail, buy services, expose secrets or migrate/delete production data without the required approval.
- Keep `docs/EXECUTION-STATUS.md` honest. A document or an issue is not proof of a running autonomous agent or of a completed store.
