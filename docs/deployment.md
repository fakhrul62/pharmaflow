# Deploying PharmaFlow

## Public portfolio preview

Vercel builds `apps/web` using `vercel.json`. `VITE_PORTFOLIO_DEMO=true` selects a curated fictional snapshot. Visitors use “Enter demo workspace”; sessions expire after 30 minutes and logout clears the session. Every non-GET request except starting/ending the preview is rejected in the preview adapter. There is no live database connection, credential or writable server behind this preview. Reloading restores the data and dates move with the demo timeline. Browser sessions are presentation state, not a security boundary protecting private data: everything shipped in the snapshot is public fictional content.

The normal local build leaves this flag unset and uses the real Nest API and PostgreSQL. Never export real pharmacy data with `scripts/prepare-portfolio.mjs`; that maintainer script is solely for the seeded fictional local database.

## Full Node/PostgreSQL deployment

The root Dockerfile builds both apps and serves the React build and `/api` from Nest on one origin. It includes a PostgreSQL readiness check, non-root runtime user and automatic migration deployment. Set:

- `DATABASE_URL`: a private PostgreSQL connection URL.
- `APP_ORIGIN`: the exact HTTPS app origin (comma-separated if needed).
- `NODE_ENV=production`, `HOST=0.0.0.0`, `SERVE_WEB=true` (already Docker defaults).
- `PORT`: host-assigned HTTP port, default 3001.

Use `render.yaml` as an optional paid Render blueprint; review its web/database plan costs before creating resources. No Render resources were provisioned by this work. Any Node container host with PostgreSQL and TLS termination can use the image.

Build: `docker build -t pharmaflow .`. Run with your host's secret injection. Deploy migrations before traffic. On an empty database create the first administrator using `npm run admin:create -w @pharmaflow/api` with `ADMIN_EMAIL`, `ADMIN_PASSWORD` and optional `ADMIN_NAME` injected for that command only. Do not use demo passwords or seed demonstration accounts into production.

Verify `/api/health` returns 200 and `status: ok`; a disconnected database yields 503. The health response does not expose connection details. Unexpected 5xx requests emit JSON correlation logs with `X-Request-Id`, method, path and status; private request bodies and connection strings are not logged. Configure your host log retention and an external uptime check on this endpoint. A single loopback API instance remains the default for local development.

Verify secure HttpOnly cookie login/logout, nested page refresh, stock persistence after restart, and receipt printing at the deployed origin before using real records. The deployment limitations in README still apply.
