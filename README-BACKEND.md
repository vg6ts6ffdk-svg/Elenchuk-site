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
5. Set `JWT_SECRET` and `ADMIN_PASSWORD` when Render asks for them.
6. Verify `/api/health`.
7. Add/verify `api.roseen.ru` as the backend custom domain.

The backend uses `/var/data` for SQLite and uploads because Render's default filesystem is ephemeral. The Blueprint attaches a persistent disk at that path.

## Domain configuration

### Frontend

In GitHub repository **Settings → Pages**, set the custom domain to `roseen.ru`.

For the apex domain, use the GitHub Pages A/AAAA records shown in GitHub Pages settings. For `www`, use a CNAME pointing to `vg6ts6ffdk-svg.github.io`.

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

## Final end-to-end test

After both hosts are live, verify in this order:

1. `GET https://api.roseen.ru/api/health` returns HTTP 200 and `ok: true`.
2. Open `https://roseen.ru` and check desktop/mobile navigation.
3. Submit a request without an attachment.
4. Submit a request with image/PDF attachment.
5. Open `https://roseen.ru/admin.html` and authenticate.
6. Confirm both requests appear.
7. Open a request and change its status/comment.
8. Download the protected attachment from the admin panel.
9. Confirm an unauthenticated request to `/api/requests` returns HTTP 401.
10. Confirm `/server.js`, `/roseen.db`, `/uploads/*` and other server-side files are not publicly accessible.

Do not merge the production branch until this complete flow succeeds.
