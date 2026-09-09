# ROSEEN Full Stack

## Архитектура
- Express API
- SQLite + better-sqlite3
- JWT для сотрудников
- bcrypt для паролей
- Multer для загрузки файлов
- Helmet/CORS
- Статический frontend из текущего сайта

## Запуск
1. Установить Node.js 20+.
2. Скопировать `.env.example` в `.env` и изменить секрет/пароль администратора.
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

Для production следует использовать PostgreSQL вместо SQLite, HTTPS, секреты через переменные окружения/secret manager и отдельное защищённое хранилище файлов.
