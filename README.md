# GitHub Release Notification API

A Fastify monolith that lets users subscribe to GitHub release notifications by email.

`swagger.yaml` is the contract source for the assignment. Runtime behavior, requests, and responses should be checked against that file first.

## Architecture

- Fastify serves the REST API under `/api`.
- PostgreSQL stores repositories, subscriptions, release state, and applied migrations.
- SQL migrations run automatically on service startup.
- Local development sends confirmation and release emails through Mailpit SMTP.
- Railway production sends Resend email over the Resend HTTPS API.
- An in-process scheduler polls GitHub releases on `SCAN_INTERVAL_MS` and updates `last_seen_tag`.

## Environment variables

Copy `.env.example` to `.env` before running locally.

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | HTTP listen host |
| `PORT` | `3000` | HTTP listen port |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/releases` | PostgreSQL connection string for local host-based development |
| `APP_BASE_URL` | `http://localhost:3000` | Public base URL used in confirmation and unsubscribe links |
| `SCAN_INTERVAL_MS` | `60000` | Release scanner polling interval in milliseconds |
| `GITHUB_TOKEN` | empty | Optional GitHub token for higher API rate limits |
| `SMTP_HOST` | `localhost` | SMTP host for outgoing mail |
| `SMTP_PORT` | `1025` | SMTP port for outgoing mail |
| `SMTP_USER` | empty | Optional SMTP username |
| `SMTP_PASS` | empty | Optional SMTP password |
| `SMTP_FROM` | `noreply@example.com` | From address used in sent emails |

`docker-compose.yml` overrides the database and SMTP hostnames for the containerized `app` service, so the `.env.example` defaults stay convenient for `pnpm dev` on the host machine.
When `SMTP_HOST=smtp.resend.com` and `SMTP_USER=resend`, the app treats
`SMTP_PASS` as a Resend API key and sends email through the Resend HTTPS API
instead of opening an SMTP connection. Other hosts keep using SMTP.

## Run locally with pnpm

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

3. Start local dependencies:

   ```bash
   docker compose up -d postgres mailpit
   ```

4. Start the API:

   ```bash
   pnpm dev
   ```

The API listens on `http://localhost:3000`, PostgreSQL is exposed on `localhost:5432`, and Mailpit is available at `http://localhost:8025`.

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Continuous integration

GitHub Actions runs `pnpm lint`, `pnpm typecheck`, and `pnpm test` on every push to `main` and on pull requests.

## Run the full stack in Docker

```bash
docker compose up --build
```

That starts:

- the API on `http://localhost:3000`
- PostgreSQL on `localhost:5432`
- Mailpit SMTP on `localhost:1025`
- Mailpit UI on `http://localhost:8025`
- Swagger UI on `http://localhost:8081`

Swagger UI serves a local browser interface for `swagger.yaml`. The checked-in
contract still uses `releases-api.app`, so the Compose-only Nginx proxy rewrites
the served copy to `localhost:8081` and forwards `/api` requests to the `app`
container. This keeps the source contract unchanged while making "Try it out"
work locally without adding CORS support to the API.

To stop everything and remove the named volume:

```bash
docker compose down -v
```

## Deploy to Railway

The app can run as one Railway service with a managed Postgres service.
The current production project uses the public app origin
`https://sfe-school-production.up.railway.app`.

Required app variables:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `HOST` | `0.0.0.0` |
| `APP_BASE_URL` | Public Railway app URL, for example `https://sfe-school-production.up.railway.app` |
| `SCAN_INTERVAL_MS` | `60000` |
| `SMTP_HOST` | `smtp.resend.com` |
| `SMTP_PORT` | `587` (kept for config compatibility; Resend production sends over HTTPS) |
| `SMTP_USER` | `resend` |
| `SMTP_PASS` | Resend API key |
| `SMTP_FROM` | Verified Resend sender, for example `GitHub Release Notifications <notifications@your-domain>` |

Do not set `PORT`; Railway supplies it at runtime. Keep Postgres private by
using the `Postgres.DATABASE_URL` reference from the app service rather than a
public database URL.

The `SMTP_*` names are shared with the local Mailpit setup. On Railway, the
`smtp.resend.com` and `resend` values switch the mailer to Resend's HTTPS API,
which avoids Railway's SMTP egress limits while keeping the same app-level
configuration shape.

Resend requires a verified sender domain before production email sends. The
domain in `SMTP_FROM` must match the verified Resend domain. For controlled test
sends, use `delivered@resend.dev` or a real inbox you control; avoid fake
addresses at real providers because they bounce and can damage deliverability.

## Manual smoke test

Create a subscription:

```bash
curl --request POST \
  --url http://localhost:3000/api/subscribe \
  --header 'content-type: application/json' \
  --data '{"email":"alice@example.com","repo":"nodejs/node"}'
```

Then:

1. Open Mailpit at `http://localhost:8025`.
2. Open the confirmation email and follow the `/api/confirm/{token}` link.
3. List active subscriptions:

   ```bash
   curl 'http://localhost:3000/api/subscriptions?email=alice@example.com'
   ```

4. Follow the `/api/unsubscribe/{token}` link from the email to remove the subscription.

You can run the same flow through Swagger UI instead:

1. Open Swagger UI at `http://localhost:8081`.
2. Use `POST /subscribe` with the same JSON body shown above.
3. Open Mailpit, copy the confirmation token, and run `GET /confirm/{token}`.
4. Run `GET /subscriptions?email=alice@example.com`.
5. Copy the unsubscribe token from Mailpit and run `GET /unsubscribe/{token}`.

## Confirmation and release scanning flow

- `POST /api/subscribe` validates the GitHub repository, creates a pending subscription, and sends a confirmation email.
- `GET /api/confirm/{token}` marks the subscription as confirmed.
- `GET /api/subscriptions?email=...` returns active subscriptions for the email address.
- `GET /api/unsubscribe/{token}` marks the subscription as unsubscribed.
- The release scanner starts with the app and checks confirmed repositories on the configured interval.
- When `last_seen_tag` is `null`, the first discovered GitHub release becomes the baseline and no notification is sent.
- A release email is sent only after a later scan detects a new tag for a confirmed, active subscription.
- If GitHub rate limiting prevents repository validation, the API responds with `503` until the upstream limit clears.
