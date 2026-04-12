# Extras CI, Railway, Auth, Cache, Metrics, Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the assignment extras in order: GitHub Actions CI, Railway deployment with Postgres and Resend SMTP, API key auth, Redis GitHub API caching, Prometheus metrics, and a public Windows XP / early-browser subscription page.

**Architecture:** Keep one Fastify monolith. Add small plugins and feature modules around the current API: CI as repository automation, Railway as deployment/runtime infrastructure, API key auth as route-scope Fastify hooks, Redis behind a cache abstraction, Prometheus behind a metrics plugin, and public web routes that call existing subscription services internally. The Swagger API contract remains unchanged.

**Tech Stack:** Node 24 native TypeScript, Fastify, TypeBox, PostgreSQL, Nodemailer SMTP, Railway, Resend SMTP, Redis, `prom-client`, Vitest, pnpm, GitHub Actions.

---

## Source Material

- Spec: `docs/superpowers/specs/2026-04-11-extras-ci-railway-auth-cache-metrics-web-design.md`
- Existing architecture plan: `docs/superpowers/plans/2026-04-08-github-release-notification-api.md`
- Fixed API contract: `swagger.yaml`
- Assignment brief: `task.md`

## Scope Check

This plan covers several extras, but they are intentionally ordered and share one deployment/runtime surface. Keep them in one implementation plan, but land them as separate commits/tasks so each slice is independently reviewable and shippable.

## Mandatory Skill Routing

Use the original implementation-plan skills whenever their domains are touched:

- @node for Node runtime, scripts, config, shutdown, scheduler, mailer/runtime integration, and test runner setup.
- @fastify-best-practices for Fastify plugins, hooks, routes, schemas, error handling, and `inject()` tests.
- @typescript-magician for every TypeScript file created or modified.
- @linting-neostandard-eslint9 before changing ESLint config or lint scripts.

Use the extra skills from the approved spec:

- @use-railway before Railway discovery, deploys, variables, services, domains, logs, restarts, or health checks.
- @postgres-best-practices before Postgres setup, migrations, indexes, SQL, query changes, or Railway Postgres troubleshooting.
- @resend before Resend SMTP/provider/domain/testing/deliverability decisions.
- @resend-cli before running any `resend` CLI commands or adding Resend CLI instructions.
- @redis-development before Redis key design, TTLs, connection behavior, fallback, observability, or Railway Redis wiring.

## File Structure

Create:

- `.github/workflows/ci.yml`: GitHub Actions quality gate.
- `src/plugins/api-key-auth.ts`: reusable Fastify API key guard.
- `src/plugins/api-key-auth.test.ts`: auth guard tests.
- `src/infra/cache/cache.ts`: cache interface and no-op cache implementation.
- `src/infra/cache/redis-cache.ts`: Redis-backed JSON cache with TTL.
- `src/infra/cache/redis-cache.test.ts`: cache serialization, TTL, and fallback tests.
- `src/plugins/cache.ts`: optional Redis cache plugin/decorator.
- `src/features/metrics/metrics.ts`: Prometheus registry and metric helpers.
- `src/features/metrics/plugin.ts`: HTTP instrumentation and protected `/metrics` route.
- `src/features/metrics/plugin.test.ts`: metrics route/auth/content tests.
- `src/features/web/routes.ts`: public web routes.
- `src/features/web/templates.ts`: server-rendered XP/early-browser HTML/CSS.
- `src/features/web/routes.test.ts`: public web flow tests.

Modify:

- `.env.example`: add `API_KEY`, `REDIS_URL`, `GITHUB_CACHE_TTL_SECONDS`.
- `README.md`: update local, deployed, API key, Redis, metrics, and Resend/Railway notes.
- `docker-compose.yml`: add Redis and app `REDIS_URL`.
- `package.json` / `pnpm-lock.yaml`: add `redis`, `prom-client`, and `@fastify/formbody`.
- `src/app.ts`: register auth, cache, metrics, form body, public web routes, and pass cache/metrics dependencies.
- `src/plugins/config.ts`: add auth/cache config.
- `src/features/github/client.ts`: add cache and metrics options.
- `src/features/github/client.test.ts`: add cache tests and adjust existing tests as needed.
- `src/features/subscriptions/routes.ts`: pass metrics where needed.
- `src/features/subscriptions/routes.test.ts`: include API key header for protected API tests.
- `src/features/subscriptions/service.ts`: use public web links and optional metrics.
- `src/features/subscriptions/service.test.ts`: update confirmation/unsubscribe URL expectations and metrics assertions.
- `src/features/releases/scanner.ts`: use public unsubscribe links and optional scanner/notification metrics.
- `src/features/releases/scanner.test.ts`: update unsubscribe URL expectations and add metrics assertions.
- `src/features/releases/scheduler.ts`: pass cache/metrics dependencies into GitHub client/scanner/mailer.
- `src/infra/email/mailer.ts`: optional email metrics around successful/failed sends.
- `src/app.test.ts`: adjust root expectation after public web route exists.

Do not stage or commit unrelated user-owned changes such as the current `AGENTS.md` modification.

## Task 1: GitHub Actions CI

**Required skills:**
- @node for package-manager/runtime assumptions.

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`

- [ ] **Step 1: Write the CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches:
      - main
  pull_request:

jobs:
  quality:
    name: Lint, typecheck, and test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Enable Corepack
        run: corepack enable

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Test
        run: pnpm test
```

- [ ] **Step 2: Document CI**

Add a short README section:

```markdown
## Continuous integration

GitHub Actions runs `pnpm lint`, `pnpm typecheck`, and `pnpm test` on every push to `main` and on pull requests.
```

- [ ] **Step 3: Verify locally**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Expected: all commands exit `0`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml README.md
git commit -m "ci: add quality checks"
```

## Task 2: Deploy Current App To Railway With Postgres And Resend SMTP

**Required skills:**
- @use-railway for all Railway commands and mutations.
- @postgres-best-practices for Postgres setup and migration verification.
- @resend for Resend setup and deliverability details.
- @resend-cli before any `resend` CLI command.

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run Railway preflight**

Run:

```bash
command -v railway
railway whoami --json
railway --version
railway status --json
```

Expected:

- Railway CLI exists.
- User is authenticated.
- CLI version prints.
- Status either shows linked context or explains the directory is not linked.

If no project is linked, follow @use-railway setup decision flow. Do not create a new project if an appropriate existing project is available.

- [ ] **Step 2: Resolve target Railway project/environment/app service**

If the directory is linked:

```bash
railway status --json
railway service status --all --json
```

If not linked and no suitable project exists:

```bash
railway init --name swe-school
```

Expected:

- Target project ID/name is known.
- Target environment is production or the user-approved equivalent.
- Target app service name is known.

- [ ] **Step 3: Add or verify Railway Postgres**

First inspect existing services:

```bash
railway service status --all --json
```

If no Postgres service exists:

```bash
railway add --database postgres
```

Expected:

- One Postgres service exists.
- Its exact Railway service name is known for variable references.

- [ ] **Step 4: Configure app variables**

Set variables on the app service, adjusting `Postgres` to the exact service name if different:

```bash
railway variable set \
  DATABASE_URL='${{Postgres.DATABASE_URL}}' \
  HOST=0.0.0.0 \
  APP_BASE_URL='https://<railway-domain-after-created>' \
  SCAN_INTERVAL_MS=60000 \
  SMTP_HOST=smtp.resend.com \
  SMTP_PORT=587 \
  SMTP_USER=resend \
  SMTP_PASS='<resend-api-key>' \
  SMTP_FROM='GitHub Release Notifications <notifications@your-domain>' \
  --service <app-service>
```

Do not set `PORT`; Railway provides it.

Optional:

```bash
railway variable set GITHUB_TOKEN='<github-token>' --service <app-service>
```

Expected:

- Variables are set on the app service.
- Secret values are not printed in final summaries.

- [ ] **Step 5: Create public Railway domain**

Run:

```bash
railway domain --service <app-service> --json
```

Then set `APP_BASE_URL` to the returned public domain:

```bash
railway variable set APP_BASE_URL='https://<railway-domain>' --service <app-service>
```

Expected:

- Public domain exists.
- `APP_BASE_URL` matches the public origin.

- [ ] **Step 6: Configure source/deploy behavior**

Prefer the checked-in Dockerfile. Verify service config:

```bash
railway environment config --json
```

If Railway is not using the Dockerfile path and auto-detection is uncertain, set the builder explicitly per @use-railway deploy/configure guidance.

Expected:

- App deploys with Node 24 from the checked-in Dockerfile, or Railway config explicitly uses Node 24.
- GitHub repo auto-deploy from `main` is configured in Railway dashboard or service source configuration.

- [ ] **Step 7: Deploy current app**

Run:

```bash
railway up --service <app-service> --detach -m "Deploy release notifier API with Postgres and Resend SMTP"
```

Then inspect:

```bash
railway deployment list --service <app-service> --limit 5 --json
railway logs --service <app-service> --lines 200 --json
```

Expected:

- Deployment reaches success.
- Logs show migrations running successfully.
- No startup crash.

- [ ] **Step 8: Smoke test deployed API**

Before API key auth exists, run:

```bash
curl -i \
  --request POST \
  --url 'https://<railway-domain>/api/subscribe' \
  --header 'content-type: application/json' \
  --data '{"email":"delivered@resend.dev","repo":"nodejs/node"}'
```

Expected:

- `200` if the repository validates and email send succeeds.
- If Resend domain is not fully ready, the app may surface SMTP failure; fix Resend sender/domain setup before considering deployment healthy.

- [ ] **Step 9: Document Railway deployment**

Add README notes for:

- Railway app, Postgres, domain, and variable requirements.
- Resend sender/domain requirement.
- `PORT` is supplied by Railway.
- Use `delivered@resend.dev` or a real controlled inbox for test sends; do not use fake real-provider addresses.

- [ ] **Step 10: Verify and commit docs**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Expected: all commands exit `0`.

Commit only README or deployment doc changes:

```bash
git add README.md
git commit -m "docs: add railway deployment notes"
```

If no files changed, skip the commit.

## Task 3: API Key Auth And Minimal Public Token Routes

**Required skills:**
- @node, @fastify-best-practices, @typescript-magician for config, plugins, hooks, and tests.
- @use-railway when setting `API_KEY` on Railway.

**Files:**
- Create: `src/plugins/api-key-auth.ts`
- Create: `src/plugins/api-key-auth.test.ts`
- Create: `src/features/web/routes.ts`
- Create: `src/features/web/templates.ts`
- Create: `src/features/web/routes.test.ts`
- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Modify: `README.md`
- Modify: `src/app.ts`
- Modify: `src/plugins/config.ts`
- Modify: `src/features/subscriptions/routes.test.ts`
- Modify: `src/features/subscriptions/service.ts`
- Modify: `src/features/subscriptions/service.test.ts`
- Modify: `src/features/releases/scanner.ts`
- Modify: `src/features/releases/scanner.test.ts`

This task adds minimal public token-result pages because protected `/api/confirm/:token` and `/api/unsubscribe/:token` are no longer usable from ordinary email clicks. The full styled subscription form lands in Task 6.

- [ ] **Step 1: Add failing API auth tests**

Create `src/plugins/api-key-auth.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { buildApp } from '../app.ts'

const apiKey = 'local-dev-key'

describe('API key auth', () => {
  it('rejects protected API requests without x-api-key', async () => {
    const app = buildApp()
    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: '/api/subscriptions?email=user@example.com'
    })

    expect(response.statusCode).toBe(401)
    await app.close()
  })

  it('rejects protected API requests with the wrong x-api-key', async () => {
    const app = buildApp()
    await app.ready()

    const response = await app.inject({
      headers: {
        'x-api-key': 'wrong-key'
      },
      method: 'GET',
      url: '/api/subscriptions?email=user@example.com'
    })

    expect(response.statusCode).toBe(401)
    await app.close()
  })

  it('allows protected API requests with the configured x-api-key', async () => {
    const app = buildApp()
    await app.ready()

    const response = await app.inject({
      headers: {
        'x-api-key': apiKey
      },
      method: 'GET',
      url: '/api/subscriptions?email=user@example.com'
    })

    expect(response.statusCode).not.toBe(401)
    await app.close()
  })
})
```

- [ ] **Step 2: Run the auth tests and verify failure**

Run:

```bash
pnpm test -- src/plugins/api-key-auth.test.ts
```

Expected: fails because the auth plugin/config does not exist yet.

- [ ] **Step 3: Add `API_KEY` config**

Update `src/plugins/config.ts`:

```ts
API_KEY: Type.String({ default: 'local-dev-key' }),
```

After loading config, fail fast in production if the environment variable is missing:

```ts
if (
  process.env.NODE_ENV === 'production' &&
  (process.env.API_KEY === undefined || process.env.API_KEY === '')
) {
  throw new Error('API_KEY must be set in production')
}
```

Keep the current `loadConfig()` shape, but assign the result to `config` before returning it. This catches a missing Railway `API_KEY` while still allowing Docker Compose to provide a local default explicitly.

- [ ] **Step 4: Add API key auth plugin**

Create `src/plugins/api-key-auth.ts`:

```ts
import fp from 'fastify-plugin'
import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify'

function readApiKeyHeader (request: FastifyRequest): string | undefined {
  const header = request.headers['x-api-key']

  return Array.isArray(header) ? header[0] : header
}

export function verifyApiKey (
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (readApiKeyHeader(request) !== request.server.config.API_KEY) {
    return reply.code(401).send({
      statusCode: 401,
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid API key'
    })
  }
}

const apiKeyAuthPlugin: FastifyPluginCallback = (fastify, _options, done) => {
  fastify.addHook('onRequest', verifyApiKey)
  done()
}

export default fp(apiKeyAuthPlugin, {
  name: 'api-key-auth',
  dependencies: ['config']
})
```

- [ ] **Step 5: Register auth around `/api` routes**

Update `src/app.ts`:

```ts
import apiKeyAuthPlugin from './plugins/api-key-auth.ts'
```

Inside the `/api` registration:

```ts
app.register(async function apiRoutes (api) {
  await api.register(apiKeyAuthPlugin)
  await api.register(subscriptionsRoutes, featureOptions.subscriptions ?? {})
}, {
  prefix: '/api'
})
```

- [ ] **Step 6: Update protected API route tests**

In `src/features/subscriptions/routes.test.ts`, add a shared header:

```ts
const authHeaders = {
  'x-api-key': 'local-dev-key'
}
```

Add `headers: authHeaders` to every `/api/*` request that is testing subscription behavior rather than auth behavior.

- [ ] **Step 7: Change email links to public token routes**

Update `src/features/subscriptions/service.ts`:

```ts
confirmUrl: `${options.appBaseUrl}/confirm/${pendingSubscription.confirmToken}`,
unsubscribeUrl: `${options.appBaseUrl}/unsubscribe/${pendingSubscription.unsubscribeToken}`
```

Update `src/features/releases/scanner.ts`:

```ts
unsubscribeUrl: `${options.appBaseUrl}/unsubscribe/${subscriber.unsubscribeToken}`
```

Update tests in `src/features/subscriptions/service.test.ts` and `src/features/releases/scanner.test.ts` to expect the public URLs.

- [ ] **Step 8: Add minimal public token routes**

Create `src/features/web/templates.ts`:

```ts
export type TokenPageState = 'success' | 'failure'

function escapeHtml (value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function renderTokenResultPage (input: {
  heading: string
  message: string
  state: TokenPageState
}) {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(input.heading)}</title>`,
    '</head>',
    '<body>',
    `<main data-state="${input.state}">`,
    `<h1>${escapeHtml(input.heading)}</h1>`,
    `<p>${escapeHtml(input.message)}</p>`,
    '<p><a href="/">Back to Release Notifier XP</a></p>',
    '</main>',
    '</body>',
    '</html>'
  ].join('')
}
```

Create `src/features/web/routes.ts` with `GET /confirm/:token` and `GET /unsubscribe/:token`. Keep this minimal for now:

```ts
import fp from 'fastify-plugin'
import type { FastifyPluginCallback, FastifyPluginOptions } from 'fastify'

import type { SubscriptionService } from '../subscriptions/service.ts'
import { renderTokenResultPage } from './templates.ts'
import { createGitHubClient } from '../github/client.ts'
import { createMailer } from '../../infra/email/mailer.ts'
import { createSubscriptionRepository } from '../subscriptions/repository.ts'
import { createSubscriptionService } from '../subscriptions/service.ts'
import { AppError } from '../../shared/errors.ts'

export type WebRoutesOptions = FastifyPluginOptions & {
  service?: SubscriptionService
}

const webRoutesPlugin: FastifyPluginCallback<WebRoutesOptions> = (
  fastify,
  options,
  done
) => {
  const service = options.service ?? createSubscriptionService({
    appBaseUrl: fastify.config.APP_BASE_URL,
    githubClient: createGitHubClient({
      token: fastify.config.GITHUB_TOKEN
    }),
    mailer: createMailer({
      from: fastify.config.SMTP_FROM,
      host: fastify.config.SMTP_HOST,
      pass: fastify.config.SMTP_PASS,
      port: fastify.config.SMTP_PORT,
      user: fastify.config.SMTP_USER
    }),
    repository: createSubscriptionRepository(fastify.pg)
  })

  fastify.get('/confirm/:token', async (request, reply) => {
    const { token } = request.params as { token: string }

    try {
      await service.confirmSubscription(token)
      return reply.type('text/html').send(renderTokenResultPage({
        heading: 'Subscription confirmed',
        message: 'You are now watching this repository.',
        state: 'success'
      }))
    } catch (error) {
      const message = error instanceof AppError ? error.message : 'Confirmation failed.'
      return reply.code(error instanceof AppError ? error.statusCode : 500).type('text/html').send(renderTokenResultPage({
        heading: 'Confirmation failed',
        message,
        state: 'failure'
      }))
    }
  })

  fastify.get('/unsubscribe/:token', async (request, reply) => {
    const { token } = request.params as { token: string }

    try {
      await service.unsubscribe(token)
      return reply.type('text/html').send(renderTokenResultPage({
        heading: 'Unsubscribed',
        message: 'Release notifications have been turned off.',
        state: 'success'
      }))
    } catch (error) {
      const message = error instanceof AppError ? error.message : 'Unsubscribe failed.'
      return reply.code(error instanceof AppError ? error.statusCode : 500).type('text/html').send(renderTokenResultPage({
        heading: 'Unsubscribe failed',
        message,
        state: 'failure'
      }))
    }
  })

  done()
}

export default fp(webRoutesPlugin, {
  name: 'web-routes',
  dependencies: ['config', 'database', 'errors']
})
```

Adjust the snippet during implementation if TypeBox param schemas are preferred; keep the public behavior the same.

- [ ] **Step 9: Register public web routes**

Update `src/app.ts`:

```ts
import webRoutes, { type WebRoutesOptions } from './features/web/routes.ts'
```

Extend feature options:

```ts
web?: WebRoutesOptions
```

Register web routes outside `/api`:

```ts
app.register(webRoutes, featureOptions.web ?? {})
```

- [ ] **Step 10: Add public token route tests**

Create `src/features/web/routes.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import { buildApp } from '../../app.ts'

const validToken = '00000000-0000-4000-8000-000000000001'

function createServiceStub () {
  return {
    confirmSubscription: vi.fn(() => Promise.resolve()),
    getSubscriptionsByEmail: vi.fn(() => Promise.resolve([])),
    subscribe: vi.fn(() => Promise.resolve()),
    unsubscribe: vi.fn(() => Promise.resolve())
  }
}

describe('public token routes', () => {
  it('confirms subscriptions without an API key', async () => {
    const service = createServiceStub()
    const app = buildApp({}, { web: { service } })
    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: `/confirm/${validToken}`
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/html')
    expect(response.body).toContain('Subscription confirmed')
    expect(service.confirmSubscription).toHaveBeenCalledWith(validToken)
    await app.close()
  })

  it('unsubscribes without an API key', async () => {
    const service = createServiceStub()
    const app = buildApp({}, { web: { service } })
    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: `/unsubscribe/${validToken}`
    })

    expect(response.statusCode).toBe(200)
    expect(response.body).toContain('Unsubscribed')
    expect(service.unsubscribe).toHaveBeenCalledWith(validToken)
    await app.close()
  })
})
```

- [ ] **Step 11: Update environment and docs**

Update `.env.example`:

```env
API_KEY=local-dev-key
```

Update `docker-compose.yml` app environment:

```yaml
API_KEY: ${API_KEY:-local-dev-key}
```

Update README curl examples with:

```bash
--header 'x-api-key: local-dev-key'
```

Document that email links use public `/confirm/:token` and `/unsubscribe/:token`.

- [ ] **Step 12: Verify locally**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Expected: all commands exit `0`.

- [ ] **Step 13: Set Railway `API_KEY`**

Use @use-railway. Generate a long random value locally, then set it:

```bash
railway variable set API_KEY='<long-random-secret>' --service <app-service>
railway variable list --service <app-service> --json
```

Expected:

- `API_KEY` exists on the app service.
- The app redeploys or is restarted with the new value.

- [ ] **Step 14: Smoke test deployed auth**

Run:

```bash
curl -i 'https://<railway-domain>/api/subscriptions?email=alice@example.com'
curl -i 'https://<railway-domain>/api/subscriptions?email=alice@example.com' \
  --header 'x-api-key: <long-random-secret>'
```

Expected:

- First response is `401`.
- Second response is not `401` and follows normal API behavior.

- [ ] **Step 15: Commit**

```bash
git add .env.example docker-compose.yml README.md src/app.ts src/plugins/config.ts src/plugins/api-key-auth.ts src/plugins/api-key-auth.test.ts src/features/web/routes.ts src/features/web/templates.ts src/features/web/routes.test.ts src/features/subscriptions/routes.test.ts src/features/subscriptions/service.ts src/features/subscriptions/service.test.ts src/features/releases/scanner.ts src/features/releases/scanner.test.ts
git commit -m "feat: protect api with api key"
```

## Task 4: Redis GitHub API Caching

**Required skills:**
- @redis-development for key naming, TTLs, connection behavior, fallback, and observability.
- @use-railway for Railway Redis provisioning and variable wiring.
- @postgres-best-practices if any Postgres changes become necessary.
- @node, @typescript-magician for cache code and dependency setup.

**Files:**
- Create: `src/infra/cache/cache.ts`
- Create: `src/infra/cache/redis-cache.ts`
- Create: `src/infra/cache/redis-cache.test.ts`
- Create: `src/plugins/cache.ts`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docker-compose.yml`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/app.ts`
- Modify: `src/plugins/config.ts`
- Modify: `src/features/github/client.ts`
- Modify: `src/features/github/client.test.ts`
- Modify: `src/features/subscriptions/routes.ts`
- Modify: `src/features/releases/scheduler.ts`
- Modify: `src/features/web/routes.ts`

- [ ] **Step 1: Install Redis dependency**

Run:

```bash
pnpm add redis
```

Expected: `package.json` and `pnpm-lock.yaml` update.

- [ ] **Step 2: Add failing GitHub cache tests**

In `src/features/github/client.test.ts`, add tests proving:

- repository-exists cache hit skips fetch
- repository-not-found cache hit skips fetch and throws `GitHubRepositoryNotFoundError`
- latest-release cache hit skips fetch
- no-release cache hit returns `null`
- cache get failure falls back to HTTP
- cache set failure does not fail the GitHub operation

Use a fake cache:

```ts
function createCacheStub () {
  const values = new Map<string, unknown>()

  return {
    values,
    implementation: {
      getJson: vi.fn(<T>(key: string) => Promise.resolve((values.get(key) as T | undefined) ?? null)),
      setJson: vi.fn((key: string, value: unknown) => {
        values.set(key, value)
        return Promise.resolve()
      })
    }
  }
}
```

- [ ] **Step 3: Run GitHub cache tests and verify failure**

Run:

```bash
pnpm test -- src/features/github/client.test.ts
```

Expected: new tests fail because the client has no cache option.

- [ ] **Step 4: Create cache interface**

Create `src/infra/cache/cache.ts`:

```ts
export type Cache = {
  getJson: <T>(key: string) => Promise<T | null>
  setJson: (key: string, value: unknown, ttlSeconds: number) => Promise<void>
}

export const nullCache: Cache = {
  async getJson () {
    return null
  },
  async setJson () {}
}
```

- [ ] **Step 5: Add cache support to GitHub client**

Update `src/features/github/client.ts`:

```ts
import { nullCache, type Cache } from '../../infra/cache/cache.ts'
```

Extend options:

```ts
cache?: Cache
cacheTtlSeconds?: number
```

Use versioned keys:

```ts
const repoExistsKey = `github:repo-exists:v1:${parsedRepo.repoFullName}`
const latestReleaseKey = `github:latest-release:v1:${parsedRepo.repoFullName}`
```

Store envelopes, not bare `null`, so cache miss remains distinguishable:

```ts
type RepoExistsCacheValue = { exists: boolean }
type LatestReleaseCacheValue = { tag: string | null }
```

Cache behavior:

- On repo exists hit `{ exists: true }`, return.
- On repo exists hit `{ exists: false }`, throw `GitHubRepositoryNotFoundError`.
- On latest release hit `{ tag }`, return the tag, including `null`.
- On miss, fetch GitHub and set cache with TTL.
- Wrap cache get/set failures and continue uncached.
- Do not cache rate-limit errors.

- [ ] **Step 6: Verify GitHub cache tests pass**

Run:

```bash
pnpm test -- src/features/github/client.test.ts
```

Expected: pass.

- [ ] **Step 7: Create Redis cache implementation tests**

Create `src/infra/cache/redis-cache.test.ts` using a fake Redis client object. Test:

- `getJson()` parses stored JSON
- `getJson()` returns `null` for missing keys
- invalid JSON returns `null`
- `setJson()` uses TTL

Expected fake client shape:

```ts
type RedisClientLike = {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string, options: { EX: number }) => Promise<unknown>
}
```

- [ ] **Step 8: Implement Redis cache**

Create `src/infra/cache/redis-cache.ts`:

```ts
import type { Cache } from './cache.ts'

type RedisClientLike = {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string, options: { EX: number }) => Promise<unknown>
}

export function createRedisCache (client: RedisClientLike): Cache {
  return {
    async getJson<T> (key) {
      const rawValue = await client.get(key)

      if (rawValue === null) {
        return null
      }

      try {
        return JSON.parse(rawValue) as T
      } catch {
        return null
      }
    },
    async setJson (key, value, ttlSeconds) {
      await client.set(key, JSON.stringify(value), {
        EX: ttlSeconds
      })
    }
  }
}
```

- [ ] **Step 9: Add cache config**

Update `src/plugins/config.ts`:

```ts
REDIS_URL: Type.Optional(Type.String()),
GITHUB_CACHE_TTL_SECONDS: Type.Integer({ default: 600 })
```

Update `.env.example`:

```env
REDIS_URL=redis://localhost:6379
GITHUB_CACHE_TTL_SECONDS=600
```

- [ ] **Step 10: Add cache plugin**

Create `src/plugins/cache.ts`:

```ts
import { createClient, type RedisClientType } from 'redis'
import fp from 'fastify-plugin'

import { nullCache, type Cache } from '../infra/cache/cache.ts'
import { createRedisCache } from '../infra/cache/redis-cache.ts'

declare module 'fastify' {
  interface FastifyInstance {
    cache: Cache
  }
}

export default fp(async function cachePlugin (fastify) {
  if (fastify.config.REDIS_URL === undefined || fastify.config.REDIS_URL === '') {
    fastify.decorate('cache', nullCache)
    return
  }

  const client: RedisClientType = createClient({
    socket: {
      connectTimeout: 1000
    },
    url: fastify.config.REDIS_URL
  })

  client.on('error', (error) => {
    fastify.log.warn({ err: error }, 'redis cache error')
  })

  try {
    await client.connect()
    fastify.decorate('cache', createRedisCache(client))
    fastify.addHook('onClose', async () => {
      await client.quit()
    })
  } catch (error) {
    fastify.log.warn({ err: error }, 'redis unavailable; continuing without cache')
    fastify.decorate('cache', nullCache)
  }
}, {
  name: 'cache',
  dependencies: ['config']
})
```

Adjust types for the installed `redis` version if needed.

- [ ] **Step 11: Register cache and pass it to GitHub clients**

Update `src/app.ts`:

```ts
import cachePlugin from './plugins/cache.ts'
```

Register after config and before features:

```ts
app.register(cachePlugin)
```

Update GitHub client creation in:

- `src/features/subscriptions/routes.ts`
- `src/features/releases/scheduler.ts`
- `src/features/web/routes.ts`

Pass:

```ts
cache: fastify.cache,
cacheTtlSeconds: fastify.config.GITHUB_CACHE_TTL_SECONDS,
token: fastify.config.GITHUB_TOKEN
```

- [ ] **Step 12: Add Redis to Docker Compose**

Update `docker-compose.yml`:

```yaml
  app:
    depends_on:
      redis:
        condition: service_started
    environment:
      REDIS_URL: redis://redis:6379
      GITHUB_CACHE_TTL_SECONDS: ${GITHUB_CACHE_TTL_SECONDS:-600}

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    restart: unless-stopped
```

Keep Redis optional in app code even if Compose starts it.

- [ ] **Step 13: Update README**

Document:

- `REDIS_URL`
- `GITHUB_CACHE_TTL_SECONDS`
- Redis is a cache only
- app falls back to uncached GitHub requests if Redis is unavailable
- Railway Redis wiring:

```env
REDIS_URL=${{Redis.REDIS_URL}}
GITHUB_CACHE_TTL_SECONDS=600
```

- [ ] **Step 14: Verify locally**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
docker compose config
```

Expected: all commands exit `0`.

- [ ] **Step 15: Add Railway Redis**

Use @use-railway and @redis-development. Check existing services first:

```bash
railway service status --all --json
```

If no Redis service exists:

```bash
railway add --database redis
```

Wire variables, adjusting `Redis` to the exact service name:

```bash
railway variable set \
  REDIS_URL='${{Redis.REDIS_URL}}' \
  GITHUB_CACHE_TTL_SECONDS=600 \
  --service <app-service>
```

Verify:

```bash
railway variable list --service <app-service> --json
railway logs --service <app-service> --lines 200 --json
```

Expected:

- App has `REDIS_URL`.
- No Redis connection crash appears in logs.

- [ ] **Step 16: Commit**

```bash
git add .env.example docker-compose.yml README.md package.json pnpm-lock.yaml src/app.ts src/plugins/config.ts src/plugins/cache.ts src/infra/cache/cache.ts src/infra/cache/redis-cache.ts src/infra/cache/redis-cache.test.ts src/features/github/client.ts src/features/github/client.test.ts src/features/subscriptions/routes.ts src/features/releases/scheduler.ts src/features/web/routes.ts
git commit -m "feat: cache github api responses in redis"
```

## Task 5: Prometheus Metrics

**Required skills:**
- @node, @fastify-best-practices, @typescript-magician for metrics code and route registration.
- @redis-development for cache metrics.
- @postgres-best-practices if any database health/query metrics are added.
- @use-railway for deployed health/log checks.

**Files:**
- Create: `src/features/metrics/metrics.ts`
- Create: `src/features/metrics/plugin.ts`
- Create: `src/features/metrics/plugin.test.ts`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/app.ts`
- Modify: `src/features/github/client.ts`
- Modify: `src/features/github/client.test.ts`
- Modify: `src/features/subscriptions/routes.ts`
- Modify: `src/features/subscriptions/service.ts`
- Modify: `src/features/subscriptions/service.test.ts`
- Modify: `src/features/releases/scanner.ts`
- Modify: `src/features/releases/scanner.test.ts`
- Modify: `src/features/releases/scheduler.ts`
- Modify: `src/infra/email/mailer.ts`

- [ ] **Step 1: Install metrics dependency**

Run:

```bash
pnpm add prom-client
```

Expected: `package.json` and `pnpm-lock.yaml` update.

- [ ] **Step 2: Add failing `/metrics` tests**

Create `src/features/metrics/plugin.test.ts` with tests for:

- missing API key returns `401`
- wrong API key returns `401`
- correct API key returns Prometheus text
- body includes `http_requests_total`

Example:

```ts
import { describe, expect, it } from 'vitest'

import { buildApp } from '../../app.ts'

describe('/metrics', () => {
  it('requires the API key', async () => {
    const app = buildApp()
    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: '/metrics'
    })

    expect(response.statusCode).toBe(401)
    await app.close()
  })

  it('returns prometheus text with the API key', async () => {
    const app = buildApp()
    await app.ready()

    await app.inject({
      method: 'GET',
      url: '/confirm/00000000-0000-4000-8000-000000000001'
    })

    const response = await app.inject({
      headers: {
        'x-api-key': 'local-dev-key'
      },
      method: 'GET',
      url: '/metrics'
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/plain')
    expect(response.body).toContain('http_requests_total')
    await app.close()
  })
})
```

- [ ] **Step 3: Run metrics tests and verify failure**

Run:

```bash
pnpm test -- src/features/metrics/plugin.test.ts
```

Expected: fails because `/metrics` does not exist.

- [ ] **Step 4: Create metrics helper module**

Create `src/features/metrics/metrics.ts` with a factory that returns a registry and narrow increment/observe helpers:

```ts
import * as client from 'prom-client'

export type Metrics = {
  registry: client.Registry
  githubCache: (operation: string, result: string) => void
  githubRequest: (operation: string, result: string) => void
  recordHttpRequest: (input: {
    durationSeconds: number
    method: string
    route: string
    statusCode: number
  }) => void
  releaseNotification: (result: string) => void
  scannerRun: (result: string) => void
  subscriptionsConfirmed: () => void
  subscriptionsCreated: () => void
  subscriptionsUnsubscribed: () => void
}

export function createMetrics (): Metrics {
  const registry = new client.Registry()
  client.collectDefaultMetrics({ register: registry })

  const httpRequests = new client.Counter({
    help: 'Total HTTP requests.',
    labelNames: ['method', 'route', 'status_code'],
    name: 'http_requests_total',
    registers: [registry]
  })

  const httpDuration = new client.Histogram({
    help: 'HTTP request duration in seconds.',
    labelNames: ['method', 'route', 'status_code'],
    name: 'http_request_duration_seconds',
    registers: [registry]
  })

  const subscriptionsCreated = new client.Counter({
    help: 'Total successful subscription creation requests.',
    name: 'subscriptions_created_total',
    registers: [registry]
  })

  const subscriptionsConfirmed = new client.Counter({
    help: 'Total successful subscription confirmations.',
    name: 'subscriptions_confirmed_total',
    registers: [registry]
  })

  const subscriptionsUnsubscribed = new client.Counter({
    help: 'Total successful unsubscribes.',
    name: 'subscriptions_unsubscribed_total',
    registers: [registry]
  })

  const githubRequests = new client.Counter({
    help: 'Total GitHub API requests.',
    labelNames: ['operation', 'result'],
    name: 'github_requests_total',
    registers: [registry]
  })

  const githubCache = new client.Counter({
    help: 'Total GitHub cache lookups.',
    labelNames: ['operation', 'result'],
    name: 'github_cache_total',
    registers: [registry]
  })

  const scannerRuns = new client.Counter({
    help: 'Total release scanner runs.',
    labelNames: ['result'],
    name: 'release_scanner_runs_total',
    registers: [registry]
  })

  const releaseNotifications = new client.Counter({
    help: 'Total release notification email attempts.',
    labelNames: ['result'],
    name: 'release_notifications_sent_total',
    registers: [registry]
  })

  return {
    registry,
    recordHttpRequest (input: {
      durationSeconds: number
      method: string
      route: string
      statusCode: number
    }) {
      const labels = {
        method: input.method,
        route: input.route,
        status_code: String(input.statusCode)
      }

      httpRequests.inc(labels)
      httpDuration.observe(labels, input.durationSeconds)
    },
    subscriptionsCreated: () => subscriptionsCreated.inc(),
    subscriptionsConfirmed: () => subscriptionsConfirmed.inc(),
    subscriptionsUnsubscribed: () => subscriptionsUnsubscribed.inc(),
    githubRequest: (operation: string, result: string) => githubRequests.inc({ operation, result }),
    githubCache: (operation: string, result: string) => githubCache.inc({ operation, result }),
    scannerRun: (result: string) => scannerRuns.inc({ result }),
    releaseNotification: (result: string) => releaseNotifications.inc({ result })
  }
}

export function createNoopMetrics (): Metrics {
  return {
    registry: new client.Registry(),
    subscriptionsCreated () {},
    subscriptionsConfirmed () {},
    subscriptionsUnsubscribed () {},
    githubRequest () {},
    githubCache () {},
    scannerRun () {},
    releaseNotification () {},
    recordHttpRequest () {}
  }
}
```

The final code must not register duplicate metrics globally between tests. Keep every metric attached to the per-app registry created by `createMetrics()`.

- [ ] **Step 5: Add metrics plugin**

Create `src/features/metrics/plugin.ts`:

```ts
import fp from 'fastify-plugin'
import type { FastifyPluginCallback, FastifyRequest } from 'fastify'

import { verifyApiKey } from '../../plugins/api-key-auth.ts'
import { createMetrics, type Metrics } from './metrics.ts'

declare module 'fastify' {
  interface FastifyInstance {
    metrics: Metrics
  }
}

function routeLabel (url: string | undefined, fallbackUrl: string) {
  return url ?? fallbackUrl
}

const metricsPlugin: FastifyPluginCallback = (fastify, _options, done) => {
  const metrics = createMetrics()
  const startTimes = new WeakMap<FastifyRequest, bigint>()

  fastify.decorate('metrics', metrics)

  fastify.addHook('onRequest', async (request) => {
    startTimes.set(request, process.hrtime.bigint())
  })

  fastify.addHook('onResponse', async (request, reply) => {
    const startTime = startTimes.get(request)

    if (typeof startTime !== 'bigint') {
      return
    }

    startTimes.delete(request)

    const durationSeconds = Number(process.hrtime.bigint() - startTime) / 1_000_000_000

    metrics.recordHttpRequest({
      durationSeconds,
      method: request.method,
      route: routeLabel(request.routeOptions.url, request.url),
      statusCode: reply.statusCode
    })
  })

  fastify.get('/metrics', {
    preHandler: verifyApiKey
  }, async (_request, reply) => {
    return reply
      .type(metrics.registry.contentType)
      .send(await metrics.registry.metrics())
  })

  done()
}

export default fp(metricsPlugin, {
  name: 'metrics',
  dependencies: ['config']
})
```

Keep labels low-cardinality.

- [ ] **Step 6: Register metrics plugin**

Update `src/app.ts`:

```ts
import metricsPlugin from './features/metrics/plugin.ts'
```

Register after `errorsPlugin` and before feature routes:

```ts
app.register(metricsPlugin)
```

- [ ] **Step 7: Wire business metrics**

Add optional metrics dependencies:

- `createSubscriptionService({ metrics?: Pick<Metrics, 'subscriptionsCreated' | 'subscriptionsConfirmed' | 'subscriptionsUnsubscribed'> })`
- `createGitHubClient({ metrics?: Pick<Metrics, 'githubRequest' | 'githubCache'> })`
- `createReleaseScanner({ metrics?: Pick<Metrics, 'scannerRun' | 'releaseNotification'> })`
- `createMailer({ metrics?: Pick<Metrics, 'releaseNotification'> })` only if notification result is easier at mailer boundary.

Pass `fastify.metrics` from routes/scheduler where available. Unit tests can omit metrics and use no-op behavior.

- [ ] **Step 8: Add focused metrics unit tests**

Update existing tests:

- `src/features/subscriptions/service.test.ts`: successful subscribe/confirm/unsubscribe increments the matching optional metrics callback.
- `src/features/github/client.test.ts`: GitHub cache hit/miss and request result invoke metrics callbacks without repo-name labels.
- `src/features/releases/scanner.test.ts`: scanner success/failure callbacks fire.

- [ ] **Step 9: Update README**

Document:

```bash
curl 'http://localhost:3000/metrics' \
  --header 'x-api-key: local-dev-key'
```

Mention no emails, repositories, tokens, or secrets are used as metric labels.

- [ ] **Step 10: Verify locally**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Expected: all commands exit `0`.

- [ ] **Step 11: Smoke test deployed metrics**

Use @use-railway for deployed checks.

Run:

```bash
curl -i 'https://<railway-domain>/metrics'
curl -i 'https://<railway-domain>/metrics' \
  --header 'x-api-key: <long-random-secret>'
```

Expected:

- First response is `401`.
- Second response is `200` and includes `http_requests_total`.

- [ ] **Step 12: Commit**

```bash
git add README.md package.json pnpm-lock.yaml src/app.ts src/features/metrics/metrics.ts src/features/metrics/plugin.ts src/features/metrics/plugin.test.ts src/features/github/client.ts src/features/github/client.test.ts src/features/subscriptions/routes.ts src/features/subscriptions/service.ts src/features/subscriptions/service.test.ts src/features/releases/scanner.ts src/features/releases/scanner.test.ts src/features/releases/scheduler.ts src/infra/email/mailer.ts
git commit -m "feat: expose prometheus metrics"
```

## Task 6: Public Windows XP / Early-Browser Subscription Page

**Required skills:**
- @node, @fastify-best-practices, @typescript-magician for routes, templates, form parsing, and tests.
- @resend if changing email wording, links, sender behavior, or deliverability docs.

**Files:**
- Modify: `README.md`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/app.ts`
- Modify: `src/features/web/routes.ts`
- Modify: `src/features/web/templates.ts`
- Modify: `src/features/web/routes.test.ts`
- Modify: `src/app.test.ts`

- [ ] **Step 1: Install form parser**

Run:

```bash
pnpm add @fastify/formbody
```

Expected: `package.json` and `pnpm-lock.yaml` update.

- [ ] **Step 2: Add failing web form tests**

Update `src/features/web/routes.test.ts` to cover:

- `GET /` returns `200`, `text/html`, and contains `Release Notifier XP`
- `POST /subscribe` calls `service.subscribe()` with form fields
- invalid form or service error renders an HTML error state
- success renders a confirmation-sent state
- token routes still work and keep public access

Example success request:

```ts
const response = await app.inject({
  headers: {
    'content-type': 'application/x-www-form-urlencoded'
  },
  method: 'POST',
  payload: 'email=user%40example.com&repo=nodejs%2Fnode',
  url: '/subscribe'
})
```

- [ ] **Step 3: Run web tests and verify failure**

Run:

```bash
pnpm test -- src/features/web/routes.test.ts
```

Expected: new form tests fail because `GET /` and `POST /subscribe` do not exist yet.

- [ ] **Step 4: Register form body parser**

Update `src/app.ts`:

```ts
import fastifyFormbody from '@fastify/formbody'
```

Register before web routes:

```ts
app.register(fastifyFormbody)
```

- [ ] **Step 5: Replace minimal templates with XP-styled templates**

Update `src/features/web/templates.ts` with:

- `renderHomePage({ values?, status? })`
- `renderTokenResultPage(...)`
- HTML escaping helper
- shared page shell with inline CSS
- accessible labels
- status text that is not color-only

Required visible copy:

```text
Release Notifier XP
Track a GitHub repo. Get a tiny electronic postcard when it ships.
Repository
Email
Start Watching
Status
```

CSS direction:

```css
body {
  margin: 0;
  min-height: 100vh;
  font-family: Tahoma, Verdana, Arial, sans-serif;
  background: linear-gradient(180deg, #3a8dde 0%, #6db9ff 52%, #3b7f2d 52%, #71b34b 100%);
}

.window {
  border: 2px solid #0f3f9f;
  border-radius: 6px;
  background: #ece9d8;
  box-shadow: 6px 8px 0 rgba(0, 0, 0, 0.25);
}

.title-bar {
  background: linear-gradient(180deg, #2f8cff, #0454c8);
  color: #fff;
  font-weight: 700;
}

button,
input {
  font: inherit;
}
```

Keep the final CSS responsive; do not use tiny fixed-width text.

- [ ] **Step 6: Add public subscription routes**

Update `src/features/web/routes.ts`:

```ts
fastify.get('/', async (_request, reply) => {
  return reply.type('text/html').send(renderHomePage({}))
})

fastify.post('/subscribe', async (request, reply) => {
  const body = request.body as Partial<{ email: string, repo: string }>

  try {
    await service.subscribe({
      email: body.email ?? '',
      repo: body.repo ?? ''
    })

    return reply.type('text/html').send(renderHomePage({
      status: {
        kind: 'success',
        message: 'Inbox armed. Check your email to confirm the subscription.'
      },
      values: body
    }))
  } catch (error) {
    const message = error instanceof AppError
      ? error.message
      : 'Something went sideways while dialing GitHub.'

    return reply.code(error instanceof AppError ? error.statusCode : 500).type('text/html').send(renderHomePage({
      status: {
        kind: 'error',
        message
      },
      values: body
    }))
  }
})
```

Keep public web routes free of `x-api-key` requirements.

- [ ] **Step 7: Update app smoke test**

Update `src/app.test.ts` root request expectation:

```ts
expect(response.statusCode).toBe(200)
expect(response.body).toContain('Release Notifier XP')
```

- [ ] **Step 8: Update README**

Document:

- public page at `/`
- public confirmation and unsubscribe links
- protected API remains under `/api/*`
- deployed page is available at `APP_BASE_URL`

- [ ] **Step 9: Verify locally**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Expected: all commands exit `0`.

- [ ] **Step 10: Smoke test locally**

Run:

```bash
curl -i 'http://localhost:3000/'
curl -i \
  --request POST \
  --url 'http://localhost:3000/subscribe' \
  --header 'content-type: application/x-www-form-urlencoded' \
  --data 'email=delivered%40resend.dev&repo=nodejs%2Fnode'
```

Expected:

- `GET /` returns HTML with `Release Notifier XP`.
- `POST /subscribe` returns HTML success or an understandable Resend/GitHub error state.

- [ ] **Step 11: Smoke test deployed web page**

Run:

```bash
curl -i 'https://<railway-domain>/'
```

Expected:

- `200`
- response includes `Release Notifier XP`

- [ ] **Step 12: Commit**

```bash
git add README.md package.json pnpm-lock.yaml src/app.ts src/app.test.ts src/features/web/routes.ts src/features/web/templates.ts src/features/web/routes.test.ts
git commit -m "feat: add public subscription page"
```

## Final Verification

- [ ] **Step 1: Run full local quality checks**

```bash
pnpm lint
pnpm typecheck
pnpm test
docker compose config
```

Expected: all commands exit `0`.

- [ ] **Step 2: Run local Docker smoke check**

```bash
docker compose up --build
```

In another terminal:

```bash
curl -i 'http://localhost:3000/'
curl -i 'http://localhost:3000/api/subscriptions?email=alice@example.com'
curl -i 'http://localhost:3000/api/subscriptions?email=alice@example.com' \
  --header 'x-api-key: local-dev-key'
curl -i 'http://localhost:3000/metrics' \
  --header 'x-api-key: local-dev-key'
```

Expected:

- `/` returns HTML.
- unauthenticated `/api/*` returns `401`.
- authenticated `/api/*` follows normal behavior.
- `/metrics` returns Prometheus text with the API key.

- [ ] **Step 3: Verify deployed Railway app**

Use @use-railway:

```bash
railway deployment list --service <app-service> --limit 5 --json
railway logs --service <app-service> --lines 200 --json
```

Run:

```bash
curl -i 'https://<railway-domain>/'
curl -i 'https://<railway-domain>/api/subscriptions?email=alice@example.com'
curl -i 'https://<railway-domain>/api/subscriptions?email=alice@example.com' \
  --header 'x-api-key: <long-random-secret>'
curl -i 'https://<railway-domain>/metrics' \
  --header 'x-api-key: <long-random-secret>'
```

Expected:

- Railway deployment is healthy.
- Public web page works.
- API auth works.
- Metrics auth works.

- [ ] **Step 4: Verify real email flow**

Use @resend and @resend-cli if checking Resend from CLI.

Through the public page or curl:

```bash
curl -i \
  --request POST \
  --url 'https://<railway-domain>/subscribe' \
  --header 'content-type: application/x-www-form-urlencoded' \
  --data 'email=delivered%40resend.dev&repo=nodejs%2Fnode'
```

Expected:

- Subscription succeeds.
- Confirmation email points to `https://<railway-domain>/confirm/<token>`.
- Unsubscribe email links point to `https://<railway-domain>/unsubscribe/<token>`.

- [ ] **Step 5: Review git state**

Run:

```bash
git status --short
git log --oneline -8
```

Expected:

- Only intended changes remain.
- No unrelated `AGENTS.md` change was staged or committed.
