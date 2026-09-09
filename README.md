# ROSEEN

Адаптивный многостраничный сайт сервиса ROSEEN с отдельными направлениями, заявками и административной панелью.

## Структура
- `index.html` — главная
- `services.html` — услуги
- `robotics.html` — робототехника
- `electronics.html` — электроника
- `appliances.html` — бытовая техника
- `diagnostika.html`, `remont.html`, `servis.html`, `engineering.html` — сервисные направления
- `about.html` — о компании
- `contacts.html` — заявка
- `admin.html` — административная панель

## Frontend
- Адаптивная верстка для desktop/mobile.
- Анимации без внешних frontend-библиотек.
- Заявка отправляется в `POST /api/requests`.
- Поддерживаются изображения, видео и PDF.

## Backend
Express 5 + SQLite + JWT + bcrypt + Multer. Подробности и production-рекомендации — в `README-BACKEND.md`.

## Deployment
GitHub Pages используется только для статического frontend. Node.js/Express API должен размещаться отдельно. Workflow Pages собирает публичный `dist` и не публикует серверные файлы.

Для production задаются `JWT_SECRET`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`, `FRONTEND_ORIGIN` и при раздельном размещении `ROSEEN_API_BASE`.
