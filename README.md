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

## Development

```bash
npm install
npm start
```

For local development, configure `JWT_SECRET` and `ADMIN_PASSWORD` through environment variables.
