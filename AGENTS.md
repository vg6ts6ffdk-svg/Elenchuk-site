# ROSEEN execution contract

Read `docs/ROSEEN-MASTER-PROMPT.md` before changing this project. It is the consolidated Russian master assignment, revision 5.0 (brandbook remains 4.0).

- Preserve current functionality. Work from current main in a feature branch; no force-push or blind overwrites.
- Header: approved Cyrillic graphical РОСИН. Footer: approved graphical ROSEEN. Never substitute a typed wordmark. Preserve legitimate brand names in prose, alt, metadata and legal text.
- Preserve SVG geometry and existing masters. No regenerated logos, font files in downloadable brand kits, fake products/prices/stock, fake orders or payments.
- Commerce is gated until seller, data and real providers are verified. `commerce/catalog.mjs` is only an adapter contract; it is not an order/payment backend.
- Run `npm run check`, `npm test`, `npm run build`, `node scripts/check-site.mjs dist` and browser QA for UI changes. Report what actually ran.
- Do not publish unfinished checkout, charge money, send customer messages, change DNS/mail, buy services, expose secrets or migrate/delete production data without the required approval.
- Keep `docs/EXECUTION-STATUS.md` honest. A document or an issue is not proof of a running autonomous agent or of a completed store.
