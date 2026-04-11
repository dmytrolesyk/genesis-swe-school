# GitHub Release Notification API

A Fastify monolith that lets users subscribe to GitHub release notifications by email.

`swagger.yaml` is the contract source for the assignment. Runtime behavior, requests, and responses should be checked against that file first.

## Architecture

- Fastify serves the REST API under `/api`.
- PostgreSQL stores repositories, subscriptions, release state, and applied migrations.
- SQL migrations run automatically on service startup.
- Nodemailer sends confirmation and release emails through SMTP.
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
