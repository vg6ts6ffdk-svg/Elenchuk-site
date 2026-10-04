# ROSEEN Full Stack

## Production architecture

- Frontend: GitHub Pages → `https://roseen.ru`
- API: Render Web Service → `https://api.roseen.ru`
- Backend: Express 5 + Node.js 20+
- Persistent data: external Neon PostgreSQL in the existing production service
- Files: Neon Object Storage via its signer; uploads are protected by API authorization
- Admin: `https://roseen.ru/admin.html`

GitHub Pages is static hosting and does not execute Node.js/Express. The repository workflow publishes only the public frontend. Render runs the API separately.

## API release hardening — 4 October 2026

The API host now serves API routes only. Known public HTML addresses redirect
with HTTP 301 to the current roseen.ru page. All other paths return HTTP 404;
the repository, encoded source-file paths, templates, archives and backups are
never exposed by static middleware. Responses are no-store and noindex.

Foreign browser origins receive HTTP 403 before body/upload processing.
The current five-field service form, cached clients with category/symptom aliases
(up to seven text fields), and Bearer admin contract are preserved.
Uploads now enforce the current frontend limits (three files, 3 MiB total),
extension/MIME agreement and a matching file signature. ISO-BMFF media require a
complete, bounded ftyp box with brands matching the declared media type. Rejected inputs are
cleaned before a database transaction or object upload. The older API-branch HTML advertised 8 files / 50 MiB; it is no longer served
and redirects to the current public form (3 / 3 MiB). Existing attachments
remain downloadable through the authenticated API regardless of their size.

This change does not migrate a schema, rewrite records, rotate secrets, change
storage configuration or enable checkout. Isolated tests cover encoded paths,
redirects/404, CORS denial, malformed and oversized uploads, valid requests,
admin retrieval, status changes and exact file bytes after process restart.
Live publication and read-only production checks are recorded in its PR;
isolated SQLite tests do not prove a complete live Neon write workflow.

## Storage modes

The backend supports two storage modes:

1. **PostgreSQL (production, preferred)** — enabled automatically when `DATABASE_URL` is present. Requests, admin records and uploaded files are persistent.
2. **SQLite fallback** — used when `DATABASE_URL` is absent. This is useful for local development and temporary deployments only. On Render Free, local SQLite lives on ephemeral storage and can disappear after a restart.

`GET /api/health` reports which backend is active in the `database` field.

## Intended Blueprint deployment on Render

The following Blueprint describes an alternative setup. The existing service uses
external Neon PostgreSQL and `site-audit-fixes-v2`; credential recovery does not
provision the paid database below or switch the branch.

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
- `DATABASE_URL=<existing production PostgreSQL connection string>`
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


## Verified deployment wiring — 4 October 2026

The existing Render service `roseen-api` currently deploys branch
`site-audit-fixes-v2` of `vg6ts6ffdk-svg/Elenchuk-site`, not `main`.
The earlier render.yaml description above is an intended configuration, not
proof that the running service uses it. Do not change the linked branch as part
of GitHub credential recovery.

The production health response reports PostgreSQL and object-storage
attachments. The live deployment uses the Neon Object Storage signer; this
supersedes the PostgreSQL-only attachment description above.

Automatic deploys require an authenticated Git provider connection with access
to this repository. In Render Account Settings, manage Git Deployment
Credentials; in service Settings, choose the corresponding Git Credentials.
Keep the existing service, database, domain and environment variables.
Choose On Commit, or After CI Checks Pass when checks run for the linked branch.
Verify recovery by observing a new deploy triggered by a commit to the linked
branch, followed by a healthy `https://api.roseen.ru/api/health` response.
A successful manual deploy alone does not prove that automatic deploys work.

References: https://render.com/docs/git-provider and
https://render.com/docs/deploys.

## GitHub connection restored — 4 October 2026

Render Account Settings now lists GitHub `vg6ts6ffdk-svg` under Git Deployment
Credentials. The service source is selected through Git Provider using
`Elenchuk-site`, branch `site-audit-fixes-v2`, Node runtime, `npm install` and
`npm start`. Auto-Deploy remains On Commit; root directory and build filters
are empty. Database, secrets and custom domain remain on the existing service.

This documentation update verifies the restored commit webhook. Confirm its
merge SHA in a Render deployment with an automatic commit trigger, then check
`GET /api/health`. A source-setting redeploy is a separate operation and does
not replace that verification.
