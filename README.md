# ROSEEN

Адаптивный многостраничный сайт инженерного сервиса ROSEEN.

## Frontend

- `index.html` — главная
- `services.html` — ремонт и диагностика
- `robotics.html` — робототехника
- `electronics.html` — электроника
- `appliances.html` — бытовая техника
- `diagnostika.html`, `remont.html`, `servis.html`, `engineering.html` — дополнительные сервисные направления
- `about.html` — о сервисе
- `contacts.html` — заявка/контакты
- `admin.html` — закрытая админ-панель

Изображения хранятся локально в репозитории, а интерфейс адаптирован под мобильные устройства.

## Production

- Frontend: GitHub Pages → `https://roseen.ru`
- Backend: Express 5 / Node.js → `https://api.roseen.ru`
- Database and uploads: persistent storage on the backend host
- Forms send requests to the API and support attachments.

GitHub Pages не запускает Node.js. Поэтому frontend и backend развёртываются отдельно. Конфигурация backend-хостинга находится в `render.yaml`, а подробные инструкции — в `README-BACKEND.md`.

## Launch checklist

1. Deploy the Render Blueprint.
2. Set `JWT_SECRET` and `ADMIN_PASSWORD` in Render.
3. Verify `https://api.roseen.ru/api/health` returns `ok: true`.
4. Configure `roseen.ru` in GitHub Pages.
5. Configure DNS for `roseen.ru`, `www.roseen.ru`, and `api.roseen.ru` according to the GitHub Pages and Render dashboards.
6. Run the end-to-end request test: form → API → database → attachment → admin panel → status update → protected file download.
7. Merge the audited branch into `main` only after the end-to-end test succeeds.

## Development

```bash
npm install
npm start
```

For local development, configure `JWT_SECRET` and `ADMIN_PASSWORD` through environment variables.
