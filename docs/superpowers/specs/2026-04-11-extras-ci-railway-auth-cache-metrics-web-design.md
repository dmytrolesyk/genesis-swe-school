# Extras Design: CI, Railway, Auth, Redis, Metrics, Web

## Status

Approved during brainstorming on 2026-04-11.

## Context

The project is a single Fastify service for GitHub release email notifications. The API contract in `swagger.yaml` is fixed and must not be changed unless the user explicitly asks for a contract change.

The current implementation already includes:

- Fastify API routes under `/api`
- PostgreSQL migrations on startup
- subscription creation, confirmation, lookup, and unsubscribe flows
- GitHub repository validation and latest-release scanning
- Nodemailer SMTP integration
- Docker Compose with app, Postgres, Mailpit, and Swagger UI

This spec covers assignment extras and deployment polish, implemented in this exact order:

1. Add GitHub Actions CI.
2. Deploy current app to Railway with Postgres and real SMTP.
3. Add API key auth.
4. Add Redis caching locally and on Railway.
5. Add Prometheus `/metrics`.
6. Add a stylish deployed HTML subscription page.

## Goals

- Keep the service a monolith.
- Preserve all `/api` paths and request/response behavior defined by `swagger.yaml`.
- Make each step independently shippable and verifiable.
- Use Railway for app hosting, managed Postgres, and managed Redis.
- Use generic SMTP in code, with Resend as the recommended Railway SMTP provider.
- Protect programmatic API and metrics access with an API key.
- Keep public email confirmation, unsubscribe, and subscription form flows usable without exposing the API key.
- Give the web UI a Windows XP / early-browser personality and leave room for future fun widgets.

## Non-Goals

- No login, registration, sessions, or per-user admin accounts.
- No separate frontend app or frontend build toolchain in this phase.
- No separate API and worker services.
- No changes to `swagger.yaml`.
- No sensitive metrics labels containing emails, repository names, tokens, or secrets.

## Mandatory Skill Routing For Agents

Agents implementing this spec must use the following skills whenever the work touches their domain:

- `use-railway`: required before any Railway work, including project/service discovery, Postgres or Redis provisioning, app deploys, variable changes, domain setup, logs, metrics, restarts, redeploys, or troubleshooting. Follow its preflight rule before mutations: confirm Railway CLI availability/auth/version, resolve the target project/environment/service, prefer explicit IDs when available, and verify every mutation with a read-back command.
- `resend`: required before any Resend-related product/API/email work, including SMTP provider decisions, sender/domain setup docs, deliverability behavior, Resend API key handling, delivery-event ideas, production email testing, or any future migration from generic SMTP to the Resend SDK. Keep the application generic SMTP-based in this spec, but use this skill for Resend-specific gotchas.
- `resend-cli`: required before running any `resend` CLI command or adding CLI instructions/scripts. Use non-interactive command patterns: provide all required flags, use `--api-key` or `RESEND_API_KEY`, pass `--quiet` where useful for machine-readable output, and never rely on interactive login. Use `--yes` for destructive Resend CLI commands only after explicit user approval.
- `redis-development`: required before designing or changing Redis caching, Redis key names, TTL behavior, Redis connection lifecycle, Redis failure fallback, Redis observability, or Railway Redis wiring.
- `postgres-best-practices`: required before creating or changing SQL, migrations, indexes, Postgres queries, Postgres connection behavior, Railway Postgres setup, or any data-model change. Even though Redis caching is added, Postgres remains the source of truth.

These skills are additive to the original implementation-plan routing. Continue to use the existing required skills from `docs/superpowers/plans/2026-04-08-github-release-notification-api.md` for Node, Fastify, TypeScript, and ESLint work.

## Recommended Approach

Use one Fastify app with small plugins and feature modules:

- CI is a GitHub Actions workflow.
- Railway deploys the existing service from the GitHub repo and auto-deploys `main` after CI passes.
- API key auth is a Fastify plugin that guards `/api/*` and `/metrics`.
- Redis is added behind a small cache abstraction used by the GitHub client.
- Prometheus metrics are collected through `prom-client`.
- Public web routes call the existing subscription service internally and render server-side HTML.

This matches the current codebase and avoids adding deployment or frontend complexity before it is needed.

## Runtime Surface

Protected routes:

```text
POST /api/subscribe
GET  /api/confirm/:token
GET  /api/unsubscribe/:token
GET  /api/subscriptions?email=...
GET  /metrics
```

Public web routes:

```text
GET  /
POST /subscribe
GET  /confirm/:token
GET  /unsubscribe/:token
```

The protected API exists for scripts, Swagger/manual testing, and future operator tooling. The public web routes exist for real users who subscribe or click links from email.

## Step 1: GitHub Actions CI

Add `.github/workflows/ci.yml`.

The workflow should run on push and pull request. Use Node 24 and pnpm, then run:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
```

The workflow does not need Postgres or Redis initially because the current tests are unit and Fastify `inject()` tests with stubs. If future integration tests require real services, add service containers in a separate focused change.

Acceptance criteria:

- CI runs on push and pull request.
- CI fails on lint, typecheck, or test failures.
- The workflow uses the checked-in `pnpm-lock.yaml`.

## Step 2: Railway Deploy With Postgres And Resend SMTP

Required skills:

- `use-railway` for project/service/environment discovery, managed Postgres setup, app service configuration, variable wiring, deployment, logs, domains, and health checks.
- `postgres-best-practices` for Railway Postgres setup, connection-string handling, migration verification, and any database troubleshooting.
- `resend` for Resend production SMTP setup, sender/domain verification expectations, deliverability caveats, and safe test-address guidance.
- `resend-cli` before running any `resend` CLI commands for domain/API key/log/email verification.

Deploy the current app before implementing the remaining extras.

Railway resources:

- one app service
- one managed Postgres service
- one production environment
- one public Railway domain for the app service
- GitHub repo auto-deploy from `main`, gated by CI where Railway/GitHub configuration supports it
- the existing `Dockerfile` deployment path, or an explicitly verified Railway builder config that still runs Node 24

App variables:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
APP_BASE_URL=https://<railway-domain>
HOST=0.0.0.0
SCAN_INTERVAL_MS=60000
GITHUB_TOKEN=<optional-github-token>
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=<resend-api-key>
SMTP_FROM="GitHub Release Notifications <notifications@your-domain>"
```

`PORT` is supplied by Railway at runtime and should not be set to a self-reference.

Resend is the recommended provider because it is simple to configure for SMTP and has a useful free tier for this demo-sized app. The application code should remain generic SMTP-based so another SMTP provider can be swapped in through variables.

Resend-specific operational notes:

- Use a verified sender domain before real production sends. The default Resend sandbox sender is only suitable for limited account-owned testing.
- The `SMTP_FROM` domain must match the verified Resend domain exactly.
- Do not test production deliverability with fake addresses at real providers.
- Use Resend's documented test addresses for controlled checks where appropriate, for example `delivered@resend.dev`.
- If the implementation later switches from Nodemailer/SMTP to the Resend SDK, the `resend` skill is mandatory and SDK errors must be checked from returned `{ data, error }` values rather than assuming API errors throw.

Deployment checks:

- `railway status --json` or explicit Railway IDs confirm the target project/environment/service.
- Postgres service exists and `DATABASE_URL` is wired to the app.
- App service has a public domain.
- `APP_BASE_URL` matches the deployed public origin.
- The deployment uses the checked-in Dockerfile, or Railway service config is verified to use Node 24.
- Startup logs show migrations running successfully.
- A manual protected or pre-auth smoke flow can be run depending on current step.
- A real email can be sent through Resend after sender/domain setup is complete.

## Step 3: API Key Auth

Required skills:

- Use the existing Node/Fastify/TypeScript skill routing from the original plan for config, plugin registration, hooks, and tests.
- Use `use-railway` when setting or verifying `API_KEY` on Railway.

Add config:

```env
API_KEY=<long-random-secret>
```

Local `.env.example` can use:

```env
API_KEY=local-dev-key
```

Behavior:

- `/api/*` requires `x-api-key`.
- `/metrics` requires `x-api-key` after metrics exist.
- Missing or wrong key returns `401`.
- Public web routes do not require `x-api-key`.
- Public web routes do not send browser requests to protected `/api/*`.
- Tests can override or inject auth config without depending on a real secret.

Implementation shape:

- Add an auth plugin or hook.
- Register the guard around the `/api` plugin registration.
- Reuse the same guard for `/metrics`.
- Keep route-level handlers focused on business behavior, not key checking.

Email link change:

```text
Before:
APP_BASE_URL/api/confirm/:token
APP_BASE_URL/api/unsubscribe/:token

After:
APP_BASE_URL/confirm/:token
APP_BASE_URL/unsubscribe/:token
```

The protected API confirmation and unsubscribe endpoints remain available for API clients that send the key.

## Step 4: Redis Caching

Required skills:

- `redis-development` for cache design, key naming, TTL rules, connection behavior, Redis failure fallback, and Redis metrics/observability.
- `use-railway` for Railway Redis provisioning and variable wiring.
- `postgres-best-practices` if any fallback, migration, query, or data-model change is introduced while adding caching.

Add config:

```env
REDIS_URL=redis://localhost:6379
GITHUB_CACHE_TTL_SECONDS=600
```

Add local Redis to `docker-compose.yml`.

Add Railway Redis and wire:

```env
REDIS_URL=${{Redis.REDIS_URL}}
GITHUB_CACHE_TTL_SECONDS=600
```

Cache abstraction:

```ts
type Cache = {
  getJson<T>(key: string): Promise<T | null>
  setJson(key: string, value: unknown, ttlSeconds: number): Promise<void>
}
```

The GitHub client should depend on this abstraction rather than importing Redis directly.

Cache keys:

```text
github:repo-exists:v1:<owner>/<repo>
github:latest-release:v1:<owner>/<repo>
```

Behavior:

- Cache repository existence responses for 10 minutes.
- Cache latest release tag responses for 10 minutes.
- Cache no-release results as `null` for 10 minutes.
- Cache repository-not-found responses for 10 minutes.
- Do not cache GitHub rate-limit errors as success.
- If Redis is unavailable, log a warning and perform the GitHub HTTP call uncached.
- Postgres remains the source of truth for subscriptions and `last_seen_tag`.
- Use consistent, versioned Redis keys and avoid storing unbounded or user-specific key sets.
- Set TTL on every cache key; no GitHub cache key should be persistent.
- Configure Redis client connection timeouts so a slow cache cannot stall subscription creation or scanner runs indefinitely.

## Step 5: Prometheus Metrics

Required skills:

- Use the existing Node/Fastify/TypeScript skill routing from the original plan for metrics code and route registration.
- `redis-development` when adding Redis cache metrics or Redis observability.
- `postgres-best-practices` if adding any Postgres-backed counters, queries, or database health indicators.
- `use-railway` for checking deployed metrics access, logs, and Railway runtime health.

Add `prom-client` and expose:

```text
GET /metrics
```

The endpoint returns Prometheus text format and is protected by `x-api-key`.

Metrics:

```text
http_requests_total{method,route,status_code}
http_request_duration_seconds{method,route,status_code}
subscriptions_created_total
subscriptions_confirmed_total
subscriptions_unsubscribed_total
github_requests_total{operation,result}
github_cache_total{operation,result}
release_scanner_runs_total{result}
release_notifications_sent_total{result}
```

Label rules:

- Allowed labels: method, route template, status code, operation, result.
- Do not put email addresses, repository names, tokens, API keys, or raw error messages in labels.

Implementation notes:

- Prefer route templates over raw URLs to avoid high cardinality.
- Instrument scanner success and failure without changing scanner semantics.
- Instrument mail sending success and failure at the mailer boundary.
- Keep metrics useful for future UI widgets, but do not make `/metrics` public.

## Step 6: Public Windows XP / Early-Browser Web UI

Required skills:

- Use the existing Node/Fastify/TypeScript skill routing from the original plan for server-rendered routes, templates, request parsing, and tests.
- `resend` if changing confirmation/release email content, links, sender behavior, or deliverability wording while adding the public web flow.

Add server-rendered public web routes:

```text
GET  /
POST /subscribe
GET  /confirm/:token
GET  /unsubscribe/:token
```

Implementation shape:

```text
src/features/web/routes.ts
src/features/web/templates.ts
```

The web routes should call the same subscription service methods as the API routes:

```text
service.subscribe()
service.confirmSubscription()
service.unsubscribe()
```

They should not make HTTP self-calls to `/api/*`, and they should not expose `API_KEY` to the browser.

Visual direction:

- Windows XP / early-browser shell
- blue title bars
- beveled panels
- chunky form controls
- status bar footer
- playful but clear copy
- future-friendly widget area

Copy direction:

```text
Release Notifier XP
Track a GitHub repo. Get a tiny electronic postcard when it ships.
Repository: owner/repo
Email: you@example.com
Start Watching
Status: dialing GitHub...
```

Future expansion:

- The page can include a placeholder-friendly layout area for later widgets.
- A future Winamp-style metrics widget can show sanitized aggregate data.
- No admin dashboard or user-specific dashboard is part of this phase.

Accessibility and usability:

- The retro style must stay readable on mobile and desktop.
- Form labels must be real labels.
- Inputs and buttons must be keyboard accessible.
- Error and success states must be visible in text, not color-only.
- Avoid tiny bitmap-like text for primary content.

## Public Web Error States

`POST /subscribe` should render the form with clear status messaging:

- invalid email or request body: inline validation error
- invalid repo format: inline validation error with `owner/repo` example
- GitHub repo missing: friendly "repo not found" state
- GitHub rate limited: friendly retry-later state
- duplicate active subscription: "already subscribed or waiting for confirmation"
- success: confirmation email sent state

`GET /confirm/:token` should render:

- confirmed success
- already-confirmed success where applicable
- invalid token failure
- token-not-found failure

`GET /unsubscribe/:token` should render:

- unsubscribed success
- invalid token failure
- token-not-found failure

## Testing Strategy

Step 1:

- rely on CI running the existing local checks

Step 3:

- Fastify `inject()` tests for missing, wrong, and correct `x-api-key`
- verify `/api/*` is protected
- verify public web routes remain public after they exist

Step 4:

- unit tests for cache hit, miss, negative result, and Redis failure fallback
- GitHub client tests prove HTTP calls are skipped on cache hits

Step 5:

- `inject()` test for `/metrics` without key, wrong key, and correct key
- verify content type and expected metric names

Step 6:

- `inject()` tests for form success and error states
- confirmation and unsubscribe public route tests
- at least one HTML response assertion for important copy and form fields

Final verification after each implementation slice:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Rollout Order

1. Add CI and verify it passes locally.
2. Deploy existing app to Railway with Postgres and Resend SMTP.
3. Add API key auth and update docs/smoke commands.
4. Add Redis local support, then Railway Redis wiring.
5. Add metrics endpoint and counters.
6. Add public web routes and XP-themed HTML/CSS.
7. Re-run full verification and perform deployed smoke tests.

## Open Operational Notes

- Resend requires an API key and sender/domain setup outside the repository.
- Railway resources should be verified before mutation.
- Railway service variable references are case-sensitive, so the managed service names must be checked before wiring `DATABASE_URL` or `REDIS_URL`.
- If Railway auto-deploy CI gating is not available for the account/project configuration, keep GitHub Actions as the visible quality gate and use Railway's repo auto-deploy from `main`.
- The modified `AGENTS.md` file present before this spec was user-owned workspace state and should not be included in this spec commit.
