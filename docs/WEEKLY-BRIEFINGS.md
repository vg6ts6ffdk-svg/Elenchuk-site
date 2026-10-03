# Weekly briefings publication

The owner authorized publication of the Russian weekly robotics/service/retail briefing on roseen.ru and continued publication each Monday (29 September 2026). The existing ChatGPT task remains the researcher and publisher; this repository does not itself run a news-writing agent.

The owner renamed the public section to «Новости» on 29 September 2026. Use «Новости» in desktop/mobile navigation. `briefings.html` is a legacy redirect; never publish new content there. Existing article URLs remain stable.

## Files and editorial contract

- News section and archive: `news.html`; individual issues: `briefing-YYYY-MM-DD.html` (issue date in Europe/Moscow).
- Copy the current issue's HTML shell, approved graphical header/footer, styles and navigation. Replace title, description, canonical/OG URL, period, article and dates. Keep the article readable without JavaScript.
- Add each issue to `briefingPages` in `public-files.mjs`, to the top of the archive, and to `sitemap.xml`. Preserve prior issues and their URLs. Do not create a duplicate issue on retries.
- Read primary sources, verify dates, link directly to them, distinguish supplier claims from independently verified results and analysis. Do not mistake publication dates for deployment dates, proposals for completed projects, or maximum values for averages. State uncertainty without adding a separate regional applicability section. No invented metrics, private customer information or internal instructions in public copy.
- Cover the preceding seven days, lead with consequential findings. If little happened, say so; do not fill with old news or promotional claims. Check the last issue to avoid repetition.

The owner's rule of 3 October 2026: do not publish «Применимость в России» or «Что проверить на практике» blocks, their contents, or equivalent sections under different headings on the website. Do not relocate the removed blocks elsewhere in the article. Personal chat briefings may still contain tailored recommendations.

## Release workflow

1. Read current `AGENTS.md`, master prompt and `main`; create a feature branch from current main. Use GitHub connector or authenticated Git. Never force push or overwrite concurrent work.
2. Change only briefing content, its archive/allowlist/sitemap and relevant status notes. Future issues require no general redesign or changes to service/commerce functionality.
3. Run `npm ci` and checks under Node 22 (the package engine): `npm run check`, `npm test`, `npm run build`, `node scripts/check-site.mjs dist`. Also build/check with `ROSEEN_STOREFRONT_PUBLIC=1`, matching GitHub Pages. Review mobile and desktop in a browser, including navigation and source links.
4. Open a PR, inspect checks and available Vercel Preview. Publication is already authorized for this weekly briefing. Merge only the verified briefing PR without bypassing required checks. No separate approval is needed for each issue within this scope.
5. `main` triggers `.github/workflows/static.yml`, which builds and publishes roseen.ru via GitHub Pages. Vercel is a separate deployment; a ready Vercel deployment alone is not proof that roseen.ru is updated. Do not change DNS.
6. Confirm Pages workflow success and fetch the exact public article and archive on https://roseen.ru. Confirm the issue date/content, not just HTTP 200. Return the public link to the owner. If publication fails, report the actual failure and preserve a retriable branch/PR; do not claim success or publish duplicate issues.

Rollback: revert the briefing release commit through a new PR; preserve unrelated changes. The weekly schedule/prompt is managed in the existing ChatGPT automation, not by this document or an additional cron job.
