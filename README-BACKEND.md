# ROSEEN Full Stack

## Production architecture

- Frontend: GitHub Pages → `https://roseen.ru`
- API: Render Web Service → `https://api.roseen.ru`
- Backend: Express 5 + Node.js 20+
- Persistent data: Render PostgreSQL
- Files: stored as protected binary data in PostgreSQL
- Admin: `https://roseen.ru/admin.html`

GitHub Pages is static hosting and does not execute Node.js/Express. The repository workflow publishes only the public frontend. Render runs the API separately.

## Storage modes

The backend supports two storage modes:

1. **PostgreSQL (production, preferred)** — enabled automatically when `DATABASE_URL` is present. Requests, admin records and uploaded files are persistent.
2. **SQLite fallback** — used when `DATABASE_URL` is absent. This is useful for local development and temporary deployments only. On Render Free, local SQLite lives on ephemeral storage and can disappear after a restart.

`GET /api/health` reports which backend is active in the `database` field.

## Production deployment on Render

The repository contains `render.yaml` describing the intended production setup:

- branch: `main`
- region: Frankfurt
- web service: `roseen-api`
- health check: `/api/health`
- managed PostgreSQL: `roseen-db`
- PostgreSQL plan: `0.1c-256mb`
- initial database storage: 1 GB
- custom API domain: `api.roseen.ru`

`DATABASE_URL` is supplied to the web service from the Render PostgreSQL resource through `fromDatabase`; credentials are not committed to GitHub.

Required secrets:

- `JWT_SECRET`
- `ADMIN_PASSWORD`

## Domain configuration

### Frontend

In GitHub repository **Settings → Pages**, set the custom domain to `roseen.ru`.

For the apex domain, use the GitHub Pages A/AAAA records shown in GitHub Pages settings. For `www`, use a CNAME pointing to `vg6ts6ffdk-svg.github.io`.

### Backend

Add/verify `api.roseen.ru` as the custom domain of the Render API service. At the DNS provider, create the CNAME record Render shows for that service and verify the domain in Render.

## Environment variables

### Render API

- `NODE_ENV=production`
- `DATABASE_URL=<Render PostgreSQL internal connection string>`
- `FRONTEND_ORIGIN=https://roseen.ru,https://www.roseen.ru,https://vg6ts6ffdk-svg.github.io`
- `ADMIN_EMAIL=admin@roseen.ru`
- `JWT_SECRET=<secret>`
- `ADMIN_PASSWORD=<strong-password>`

### GitHub Pages

The Pages build defaults the frontend API URL to `https://api.roseen.ru`. A GitHub Actions repository variable named `ROSEEN_API_BASE` can override it if the API hostname changes.

## Final end-to-end test

After PostgreSQL is connected, verify in this order:

1. `GET https://api.roseen.ru/api/health` returns HTTP 200, `ok: true` and `database: "postgres"`.
2. Open `https://roseen.ru` and check desktop/mobile navigation.
3. Submit a request without an attachment.
4. Submit a request with image/PDF attachment.
5. Open `https://roseen.ru/admin.html` and authenticate.
6. Confirm both requests appear.
7. Open a request and change its status/comment.
8. Download the protected attachment from the admin panel.
9. Confirm an unauthenticated request to `/api/requests` returns HTTP 401.
10. Restart/redeploy the API and confirm the same requests still exist.
11. Confirm `/server.js`, `/roseen.db`, `/uploads/*` and other server-side files are not publicly accessible.
