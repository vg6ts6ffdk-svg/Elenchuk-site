# ROSEEN Full Stack

## Production architecture

- Frontend: GitHub Pages → `https://roseen.ru`
- API: Render Web Service → `https://api.roseen.ru`
- Backend: Express 5 + Node.js 20+
- Data: SQLite on a Render persistent disk
- Files: protected upload directory on the same persistent disk
- Admin: `https://roseen.ru/admin.html`

GitHub Pages is static hosting and does not execute Node.js/Express. The repository workflow therefore publishes only the public frontend. Render runs the API separately.

## Production deployment on Render

The repository contains `render.yaml` with the required Web Service configuration. Render Blueprints can provision a web service, custom domain, environment variables and persistent disk from this file.

1. In Render, choose **New → Blueprint**.
2. Connect `vg6ts6ffdk-svg/Elenchuk-site`.
3. Select branch `site-audit-fixes-v2` for the first deployment, then switch to `main` after the PR is merged.
4. Deploy the Blueprint from `render.yaml`.
5. Set the secret values when Render asks for them:
   - `JWT_SECRET` — long random secret;
   - `ADMIN_PASSWORD` — strong unique administrator password.
6. The service is configured with `/api/health` as its health check.
7. Add/verify `api.roseen.ru` as the backend custom domain.

The backend uses `/var/data` for SQLite and uploads because Render's default filesystem is ephemeral. The Blueprint attaches a persistent disk at that path.

## Domain configuration

### Frontend

In GitHub repository **Settings → Pages**, set the custom domain to:

`roseen.ru`

For the apex domain, use the GitHub Pages A/AAAA records recommended by GitHub. For `www`, use a CNAME pointing to `vg6ts6ffdk-svg.github.io`. Do not invent alternative DNS targets.

### Backend

Add `api.roseen.ru` as the custom domain of the Render API service. At the DNS provider, create the CNAME record Render shows for that service and then verify the domain in Render.

## Environment variables

### Render API

- `NODE_ENV=production`
- `ROSEEN_DATA_DIR=/var/data`
- `FRONTEND_ORIGIN=https://roseen.ru,https://www.roseen.ru,https://vg6ts6ffdk-svg.github.io`
- `ADMIN_EMAIL=admin@roseen.ru`
- `JWT_SECRET=<secret>`
- `ADMIN_PASSWORD=<strong-password>`

### GitHub Pages

The Pages workflow defaults the frontend API URL to `https://api.roseen.ru`. A GitHub Actions repository variable named `ROSEEN_API_BASE` can override it if the API hostname changes.

## Local launch

1. Install Node.js 20+.
2. Copy `.env.example` to `.env` and set `JWT_SECRET` and `ADMIN_PASSWORD`.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

## API

- `GET /api/health` — public health check
- `POST /api/auth/login` — administrator login
- `POST /api/requests` — public request with optional files
- `GET /api/requests` — administrator
- `GET /api/requests/:id` — administrator
- `PATCH /api/requests/:id` — administrator
- `GET /api/files/:id` — administrator

## Security notes

- Production startup fails if default JWT/admin secrets are still used.
- CORS is restricted to configured frontend origins.
- Uploads are limited to 8 files, 50 MB each, with an allowlist of image/video/PDF MIME types.
- Uploaded files and SQLite are not exposed through public static serving.
- Admin API endpoints require a JWT.
