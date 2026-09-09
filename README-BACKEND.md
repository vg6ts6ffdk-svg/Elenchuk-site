# ROSEEN Full Stack

## Архитектура
- Multi-page static frontend: HTML/CSS/JS.
- Express 5 API.
- SQLite + better-sqlite3 для локального/небольшого production-сервиса.
- JWT для сотрудников.
- bcrypt для паролей.
- Multer для загрузки файлов.
- Helmet/CORS.
- Админ-панель: `admin.html`.

## Локальный запуск
1. Установить Node.js 20+.
2. Скопировать `.env.example` в `.env` и задать `JWT_SECRET` и `ADMIN_PASSWORD`.
3. Выполнить `npm install`.
4. Выполнить `npm start`.
5. Открыть `http://localhost:3000`.

## API
- `POST /api/auth/login`
- `POST /api/requests` — публичная заявка, без авторизации
- `GET /api/requests` — админ
- `GET /api/requests/:id` — админ
- `PATCH /api/requests/:id` — админ
- `GET /api/files/:id` — админ

## Важное про GitHub Pages
GitHub Pages публикует статические HTML/CSS/JS-файлы и не запускает Node.js/Express. Поэтому API и база данных не работают внутри GitHub Pages. Workflow `.github/workflows/static.yml` собирает отдельный публичный `dist` и не публикует серверные файлы.

Для production рекомендуется:
- frontend — GitHub Pages или отдельный статический хостинг;
- backend — отдельный Node.js-хостинг/VPS;
- `FRONTEND_ORIGIN` — домен frontend для CORS;
- `ROSEEN_API_BASE` — URL backend API для frontend;
- PostgreSQL вместо SQLite при росте нагрузки;
- отдельное защищённое хранилище файлов;
- HTTPS и секреты только через переменные окружения/secret manager.

Если frontend и backend размещены на одном домене, `ROSEEN_API_BASE` можно оставить пустым и использовать относительные `/api/*`.
