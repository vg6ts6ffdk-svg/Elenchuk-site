# Release gate — 18 September 2026

Baseline main: `e2d62f38b41b5462d12508ea2fa3f462d21a4bed` (Neon storage signer). Earlier frontend work was based on `6d08c7b`; the new production branch is based on current main and preserves PostgreSQL/object storage support.

## Architecture

Plain multi-page HTML/CSS/JS; Express API; PostgreSQL in production; existing private object-storage signer preserved. SQLite is local development only. No framework rewrite. Vercel detects Express because package.json depends on Express and server.js is the application entrypoint. That is valid for the API, but READY does not prove database/env configuration is correct. Production health returned FUNCTION_INVOCATION_FAILED (HTTP 500) before this branch. The connected logs returned no diagnostic entries; the exact remote startup cause remains unverified.

## Checks completed locally

- Source and built output: 18 HTML documents, 599 local references, no missing referenced assets/anchors; syntax checks pass.
- Four integration scenarios: protected source paths/health; invalid uploads and foreign origins; request with image/login/download; pagination/status/logout revocation. All pass with disposable SQLite data.
- npm audit --omit=dev: zero known dependency vulnerabilities at check time.
- Browser: 16 non-redirect pages at 320, 768 and 1440 px, one H1 each, no horizontal overflow or observed broken loaded images.
- Mobile menu open/Escape/focus return; browser form submitted and received local request #1.

## Must verify before merge

- Vercel Preview READY **and** real browser/HTTP QA.
- Preview must use an isolated database branch and storage configuration; do not point test submissions at production data.
- Required production variables: DATABASE_URL, JWT_SECRET (random, >=32 chars), ADMIN_EMAIL, ADMIN_PASSWORD; STORAGE_SIGNER_URL and STORAGE_SIGNER_KEY if using existing object storage. Do not copy credentials into git.
- Confirm TLS certificate validation against the configured database; PostgreSQL is no longer configured with rejectUnauthorized:false.
- Schema addition is additive: sessions(id,expires_at). Test against a Neon branch before production.
- Set TRUST_PROXY_HOPS only after verifying the host's proxy chain. In-process throttling is not a global serverless WAF/quota.
- Existing admin passwords are not changed by env edits. ADMIN_PASSWORD bootstraps only absent users.
- Confirm uploaded-file persistence through restart/redeploy and downloads from existing object keys/legacy BYTEA data.
- API session cookies require the same site. Vercel uses same-origin API; roseen.ru uses api.roseen.ru. Do not weaken cookies to support unrelated preview origins.

## Upload constraints

The form accepts up to three attachments with a **combined 3 MiB** limit, below Vercel's function payload ceiling. Client and server both enforce this. Large videos require a later direct-to-storage workflow or coordinated transfer; no claim of 50 MB Vercel uploads is made. File signature checking is not antivirus scanning.

## Content still needed

Region confirmed by owner: Moscow, Moscow Oblast, other regions by agreement. No telephone, email, legal operator details or verified cases were supplied; none are invented. Image captions explicitly describe generated illustrations, not completed client work. Confirm privacy notice/operator details before accepting real customer personal data.

## Release / rollback

Merge only after the Preview gate; then verify production homepage, navigation, form, admin protection and logs. Keep the previous deployment available for rollback. No main reset, force push, deletion of business data or secret rotation is part of this branch.
