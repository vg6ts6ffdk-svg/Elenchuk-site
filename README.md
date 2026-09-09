# Elenchuk-site

Персональный сайт Романа Еленьчука.

## Структура

- `index.html` — главная
- `about.html` — обо мне
- `services.html` — компетенции
- `robots.html` — роботизированная техника
- `contacts.html` — контакты
- `style.css` — единый стиль всех страниц
- `assets/profile.jpg` — фотография
- `.github/workflows/static.yml` — публикация через GitHub Pages

GitHub Pages: публикация из ветки `main` через GitHub Actions.

## v9 scroll fix
- Fixed mobile sticky scroll storytelling: `main` now uses `overflow: clip` instead of `overflow: hidden`, so sticky scenes are not clipped by the main container.
- Extended scroll story to 420vh with deterministic four-stage progress.
- Stage 01–04 now occupy separate scroll intervals and remain visible while scrolling.
- Added keyboard/click navigation for stage cards.
- Cache-busted `style.css` to v9 on all pages.


### v10 scroll fix
Исправлена мобильная прокрутка sticky-секций: удалён overflow с родителей sticky-блоков, из-за которого iOS Safari прекращал фиксировать контент при прокрутке. Также обновлён cache-busting CSS до v10.
