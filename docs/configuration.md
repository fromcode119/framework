# Configuration

All configuration is environment variables. Copy `.env.example` to `.env` at the repo root and edit
as needed.

## Core Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | `development` \| `production` |
| `JWT_SECRET` | *generated* | Written to `data/secrets.json` on first boot if unset. A value you set wins. Minimum 32 characters. |
| `DB_DIALECT` | `postgres` | `postgres` (every multi-site deployment) or `sqlite` (single-site only) |
| `DATABASE_URL` | `postgresql://…` | Full DB connection string |
| `PORT` | `3000` | API server port |
| `ADMIN_PORT` | `3001` | Admin panel port |
| `FRONTEND_PORT` | `3002` | Frontend server port |
| `NEXT_PUBLIC_API_URL` | _(empty)_ | Base for asset URLs in server-rendered pages. Empty means relative, i.e. the visitor's own host. The browser always calls the API on the page's own origin regardless of this. |
| `API_URL` | _(empty)_ | Server-to-server API URL — use the Docker service name in containers, e.g. `http://api:3000`. On the api itself it seeds the public API URL on first boot; change it afterwards in Settings → General. |
| `CORS_ALLOWED_DOMAINS` | `localhost` | Comma-separated allowed origins |
| `DEFAULT_LOCALE` | `en` | Default language/locale |

## Database (PostgreSQL)

```bash
DB_DIALECT=postgres
DATABASE_URL=postgresql://USER:PASS@localhost:5432/fromcode
POSTGRES_USER=fromcode
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=fromcode
```

> **Why PostgreSQL everywhere:** sites are isolated by a PostgreSQL row-level-security policy. SQLite has no
> such feature, so a multi-site install must run PostgreSQL — locally too, otherwise the isolation you rely on
> in production is never exercised on your machine. SQLite still works for a single-site install.
>
> **Why three roles:** PostgreSQL skips row-level security for the table owner and for superusers. If the app
> connected as either, every site would see every other site's rows and nothing would look wrong. So the app
> connects as a plain role (`DATABASE_URL`), a separate owner role runs migrations, and the superuser is never
> used by the app.

## Integrations — Cache, Queue, Storage, Email

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | _(empty)_ | Redis connection string. Leave blank for in-memory cache. |
| `STORAGE_DRIVER` | `local` | `local`, `s3`, or `cloudinary` |
| `STORAGE_UPLOAD_DIR` | `./public/uploads` | Local upload path |
| `EMAIL_PROVIDER` | `mock` | `mock`, `smtp`, `sendgrid`, or `mailgun` |
| `SMTP_HOST` | — | SMTP server host |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | SMTP password |

These same integrations are unified kernel services, not per-plugin wiring — see
[Infrastructure & Integrations](./architecture.md#infrastructure--integrations) in the architecture doc
for how the kernel shares one Cache/Queue/Storage/Email manager across every plugin.

## Multi-site, Gateway & Isolation

| Variable | Default | Description |
|----------|---------|-------------|
| `INTERNAL_SERVICE_SECRET` | *generated* | Shared secret for service-to-service calls: the gateway's routing map, operator restart endpoints. Generated on first boot if unset; the gateway picks it up from the shared `data/` directory. |
| `GATEWAY_INTERNAL_URL` | `http://gateway:3000` | Where the api pushes routing reloads when a site is created, changed or removed |
| `GATEWAY_ROUTING_TTL_MS` | `30000` | How long the gateway keeps its routing map before refreshing (it also keeps the last map if the api is down) |
| `API_TARGET_URL` / `ADMIN_TARGET_URL` / `FRONTEND_TARGET_URL` | `http://api:3000` … | The gateway's upstreams |
| `GATEWAY_PORT` | `80` | Host port the gateway listens on (compose) |
| `GATEWAY_TLS_PORT` | _(unset)_ | Opt in to the gateway terminating TLS from the certificate store. Unset = unchanged behaviour; something in front holds the certificates |
| `GATEWAY_CERTIFICATES_TTL_MS` | `60000` | How long the gateway keeps its certificate bundle before refreshing (last good bundle survives an api outage) |
| `APPEARANCE_DIR` | `./appearance` | Installed admin appearances (product consoles) |
| `ADMIN_APPEARANCE` | _(empty)_ | Deployment default appearance for a standalone product install (a single-site deployment that IS a workspace) |

> Multi-site mode switches on by itself when the site table has rows; an installation with no sites behaves exactly as a single-site install. Adding the first site needs a restart.

See [Certificates and TLS](./certificates-and-tls.md) for how `GATEWAY_TLS_PORT` and the certificate
store fit together.

## Rate Limiting, Security & Plugins

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `PLUGINS_DIR` | `./plugins` | Path to plugins directory |
| `THEMES_DIR` | `./themes` | Path to themes directory |
| `MARKETPLACE_URL` | `https://marketplace.fromcode.com` | Plugin marketplace site URL |
