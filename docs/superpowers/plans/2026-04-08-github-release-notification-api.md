# GitHub Release Notification API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single Fastify service that matches `swagger.yaml`, stores subscriptions in a database, confirms subscriptions by email, scans GitHub releases on a schedule, and sends notification emails for new releases.

**Architecture:** Use a lean monolith with a Fastify app factory, small plugins for configuration/database/error handling, feature modules for `subscriptions`, `github`, and `releases`, and PostgreSQL accessed through focused repository classes. Run SQL migrations on startup, use an in-process polling scheduler for release scanning, close resources with explicit graceful-shutdown handling, and keep all external integrations behind small interfaces so business logic stays easy to unit test.

**Tech Stack:** Node 24 native TypeScript type stripping, Fastify, PostgreSQL via `@fastify/postgres`, TypeBox for route schemas, `env-schema`, Nodemailer, `close-with-grace`, ESLint 9 + `neostandard` + `typescript-eslint` typed linting, Vitest, Docker Compose, Mailpit.

---

## Brainstorm outcome

### Recommended approach
1. **Fastify + native TypeScript + PostgreSQL + raw SQL repositories + in-process scheduler**
   This is the best fit for the assignment. It stays simple, keeps the service as one deployable unit, makes Docker setup straightforward, and avoids the extra surface area of an ORM or a separate worker.
2. **Fastify + ORM + scheduler**
   This can work, but it adds setup and abstraction that the task does not require. For a small monolith with a tiny schema, repositories plus SQL migrations are easier to reason about.
3. **Split API and worker**
   Do not do this. It violates the assignment requirement that API, scanner, and notifier stay in one service.

### Key design decisions
- Register API routes once under the `/api` prefix so the runtime matches `swagger.yaml` without copying the prefix into every feature file.
- Use `crypto.randomUUID()` tokens for confirmation and unsubscribe links so `400 invalid token` vs `404 token not found` is easy to implement.
- Store subscriptions in a `subscriptions` table and per-repository release state in a `repositories` table keyed by `repo_full_name`.
- Treat an active subscription as `confirmed_at IS NOT NULL` and `unsubscribed_at IS NULL`.
- On the first scan of a repository with `last_seen_tag IS NULL`, store the current tag as the baseline and send no notification. Only later tag changes trigger emails.
- Handle GitHub rate limits explicitly in the client and bubble them up as typed errors. For `POST /api/subscribe`, prefer a controlled `503` response in the implementation while leaving `swagger.yaml` untouched.
- Keep `neostandard` as the ESLint baseline and layer `typescript-eslint` typed rules on top of it. Use `strictTypeCheckedOnly` rather than `strictTypeChecked` so the extra layer adds only typed strictness instead of a second broad baseline.

### Working assumptions
- Use `pnpm` as the package manager and initialize `package.json` with a pinned `packageManager` field.
- Use Node 24 in Docker and local development to keep native TypeScript execution simple.
- Use Mailpit in `docker-compose.yml` for local SMTP capture; keep the mailer implementation generic SMTP so another provider can be configured later.
- Skip extras from `task.md` until all required features pass linting and tests.

## Planned file structure

```text
.
├── .dockerignore
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── eslint.config.js
├── package.json
├── README.md
├── tsconfig.json
├── vitest.config.ts
├── db/
│   └── migrations/
│       └── 001_initial.sql
└── src/
    ├── app.ts
    ├── app.test.ts
    ├── server.ts
    ├── db/
    │   └── migrate.ts
    ├── features/
    │   ├── github/
    │   │   ├── client.test.ts
    │   │   ├── client.ts
    │   │   └── repo-ref.ts
    │   ├── releases/
    │   │   ├── repository.ts
    │   │   ├── scanner.test.ts
    │   │   ├── scanner.ts
    │   │   └── scheduler.ts
    │   └── subscriptions/
    │       ├── repository.ts
    │       ├── routes.test.ts
    │       ├── routes.ts
    │       ├── schemas.ts
    │       ├── service.test.ts
    │       └── service.ts
    ├── infra/
    │   └── email/
    │       ├── mailer.ts
    │       └── templates.ts
    ├── plugins/
    │   ├── config.ts
    │   ├── database.ts
    │   └── errors.ts
    └── shared/
        ├── errors.ts
        └── schemas.ts
```

## Delivery sequence

- `Task 1` sets up the project skeleton, native TypeScript runtime, and ESLint.
- `Task 2` adds configuration, PostgreSQL, and startup migrations.
- `Task 3` delivers `POST /api/subscribe`.
- `Task 4` delivers `GET /api/confirm/{token}`.
- `Task 5` delivers `GET /api/subscriptions?email=...`.
- `Task 6` delivers `GET /api/unsubscribe/{token}`.
- `Task 7` delivers release scanning and notification emails.
- `Task 8` adds Docker packaging, documentation, and final verification.

Each task should land with passing lint, typecheck, and tests before moving to the next one.

## Mandatory skill usage during implementation

- `linting-neostandard-eslint9` is required before creating or modifying `eslint.config.js`, `neostandard` options, or lint scripts in `package.json`.
- `node` is required for Node runtime decisions and code: `package.json` scripts, `tsconfig.json`, `vitest.config.ts`, `src/server.ts`, migration runner code, scheduler code, mailer/runtime integration, shutdown handling, and test-runner setup.
- `fastify-best-practices` is required for all Fastify-specific code: `src/app.ts`, plugins, routes, schemas, handlers, error handling, plugin registration order, and `inject()`-based API tests.
- `typescript-magician` is required for every TypeScript file created or modified in this project. Use it to keep types strict, avoid `any`, and preserve a clean `tsc --noEmit` run.
- When a task touches Fastify code in TypeScript, use `node` + `fastify-best-practices` + `typescript-magician` together.
- When a task creates or updates the ESLint config for this TypeScript project, use `linting-neostandard-eslint9`; if the same task also edits TypeScript files, use `typescript-magician` for those `.ts` files too.

### Task 1: Project foundation and linting

**Required skills:**
- `linting-neostandard-eslint9` for `eslint.config.js` and lint scripts
- `node` for `package.json`, `tsconfig.json`, `vitest.config.ts`, and `src/server.ts`
- `fastify-best-practices` for `src/app.ts` and `src/app.test.ts`
- `typescript-magician` for all `.ts` files in this task

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `eslint.config.js`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/app.ts`
- Create: `src/server.ts`
- Create: `src/app.test.ts`

- [ ] **Step 1: Initialize package metadata and scripts**

Run: `pnpm init --init-package-manager --init-type module`

Then shape `package.json` around these scripts:
- `start`: `node src/server.ts`
- `dev`: `node --watch src/server.ts`
- `lint`: `eslint .`
- `lint:fix`: `eslint . --fix`
- `typecheck`: `tsc --noEmit`
- `test`: `vitest run`
- `test:watch`: `vitest`

- [ ] **Step 2: Install runtime dependencies**

Run: `pnpm add fastify fastify-plugin @fastify/postgres @fastify/sensible env-schema @sinclair/typebox @fastify/type-provider-typebox nodemailer pg close-with-grace`

Expected: runtime dependencies installed with no peer dependency errors.

- [ ] **Step 3: Install development dependencies**

Run: `pnpm add -D typescript @types/node eslint@9 neostandard typescript-eslint vitest`

Expected: ESLint 9, TypeScript, `typescript-eslint`, and Vitest are available locally.

- [ ] **Step 4: Create `tsconfig.json` for native TypeScript execution**

Use `module` and `moduleResolution` `NodeNext`, `noEmit: true`, `strict: true`, `verbatimModuleSyntax: true`, `allowImportingTsExtensions: true`, and include `src/**/*.ts` plus `vitest.config.ts` so typed linting can resolve the whole linted TypeScript surface.

- [ ] **Step 5: Create `eslint.config.js`**

Invoke `linting-neostandard-eslint9` for this step.

Use `neostandard({ ts: true })` as the baseline config array, then add a `typescript-eslint` typed-lint block for `**/*.ts`.

Choose `typescript-eslint` `strictTypeCheckedOnly`, not `strictTypeChecked`.

Reason:
- `neostandard` is already the primary baseline
- `strictTypeCheckedOnly` adds only the typed strict rules
- it avoids stacking a second broad non-typed rule preset on top of `neostandard`

Configure the typed-lint block to:
- target `**/*.ts`
- use `parserOptions.projectService: true`
- use `parserOptions.tsconfigRootDir: import.meta.dirname`

The intended shape is:

```js
import neostandard from 'neostandard'
import tseslint from 'typescript-eslint'

export default [
  ...neostandard({
    ts: true
  }),
  // Add a typescript-eslint typed-lint layer for TypeScript files only.
  // Use `tseslint.configs.strictTypeCheckedOnly` here together with
  // `projectService: true` and `tsconfigRootDir: import.meta.dirname`.
]
```

This is required early so every later slice is built under the same quality gate.

- [ ] **Step 6: Create `vitest.config.ts`**

Invoke `node` and `typescript-magician` for this step.

Keep the config lean:
- enable Node environment
- include `src/**/*.test.ts`
- allow a shared setup file later only if the suite actually needs it

- [ ] **Step 7: Create the app factory and server entrypoint**

Invoke `node`, `fastify-best-practices`, and `typescript-magician` for this step.

`src/app.ts` should export `buildApp()` and stop before calling `listen()`.

`src/server.ts` should:
- build the app
- call startup migrations before listening
- listen on `0.0.0.0`
- use `close-with-grace` to close the app cleanly on shutdown

- [ ] **Step 8: Add a smoke test for app boot**

Invoke `fastify-best-practices` and `typescript-magician` for this step.

`src/app.test.ts` should build the app, call `app.ready()`, make one `inject()` request, and close the app. Keep it minimal; this is only a guard against broken registration order.

- [ ] **Step 9: Verify the foundation slice**

Run:
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

Expected: all commands exit `0`.

- [ ] **Step 10: Commit**

Run: `git add package.json tsconfig.json eslint.config.js vitest.config.ts .gitignore .env.example src/app.ts src/server.ts src/app.test.ts`

Commit: `git commit -m "chore: bootstrap fastify service"`

### Task 2: Configuration, database plugin, and startup migrations

**Required skills:**
- `node` for runtime bootstrap, configuration, migration runner, and shutdown behavior
- `fastify-best-practices` for plugins and centralized HTTP error handling
- `typescript-magician` for all `.ts` files in this task

**Files:**
- Create: `src/plugins/config.ts`
- Create: `src/plugins/database.ts`
- Create: `src/plugins/errors.ts`
- Create: `src/shared/errors.ts`
- Create: `src/shared/schemas.ts`
- Create: `src/db/migrate.ts`
- Create: `db/migrations/001_initial.sql`
- Modify: `src/app.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: Add configuration loading with `env-schema`**

`src/plugins/config.ts` should validate and decorate:
- `HOST`
- `PORT`
- `DATABASE_URL`
- `APP_BASE_URL`
- `SCAN_INTERVAL_MS`
- `GITHUB_TOKEN` optional
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER` optional
- `SMTP_PASS` optional
- `SMTP_FROM`

- [ ] **Step 2: Add the PostgreSQL plugin**

`src/plugins/database.ts` should register `@fastify/postgres` using `fastify.config.DATABASE_URL` and release connections through Fastify lifecycle hooks.

- [ ] **Step 3: Add shared error primitives**

Create small typed errors for:
- invalid repo format
- duplicate subscription
- token invalid
- token not found
- GitHub repository missing
- GitHub rate limited

Keep them framework-agnostic so service tests can assert on them directly.

- [ ] **Step 4: Write the initial migration**

`db/migrations/001_initial.sql` should create:
- `schema_migrations`
- `repositories`
  - `repo_full_name text primary key`
  - `last_seen_tag text null`
  - timestamps
- `subscriptions`
  - `id uuid primary key`
  - `email text not null`
  - `repo_full_name text not null references repositories(repo_full_name)`
  - `confirm_token uuid not null`
  - `unsubscribe_token uuid not null`
  - `confirmed_at timestamptz null`
  - `unsubscribed_at timestamptz null`
  - timestamps
- a partial unique index that prevents duplicate active subscriptions for the same `email + repo_full_name`

- [ ] **Step 5: Create the migration runner**

`src/db/migrate.ts` should:
- read SQL files from `db/migrations`
- create `schema_migrations` if needed
- apply unapplied files in filename order inside transactions
- record each applied filename

- [ ] **Step 6: Register the global error handler**

`src/plugins/errors.ts` should map known service errors to HTTP responses and keep unknown errors as `500`.

Important mapping rules:
- invalid body/query/path input: `400`
- repo not found: `404`
- duplicate subscription: `409`
- token not found: `404`
- GitHub rate limited during subscribe: `503`

- [ ] **Step 7: Wire startup order**

`src/app.ts` should register:
1. config
2. database
3. sensible/error handling
4. feature routes

`src/server.ts` should run migrations before `listen()`.

- [ ] **Step 8: Verify the infrastructure slice**

Run:
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

- [ ] **Step 9: Commit**

Commit: `git commit -m "feat: add configuration and database foundation"`

### Task 3: Implement `POST /api/subscribe`

**Required skills:**
- `node` for GitHub client runtime behavior, mailer integration, and test setup
- `fastify-best-practices` for route schemas, handlers, plugin wiring, and `inject()` route tests
- `typescript-magician` for all `.ts` files in this task

**Files:**
- Create: `src/features/github/repo-ref.ts`
- Create: `src/features/github/client.ts`
- Create: `src/features/github/client.test.ts`
- Create: `src/infra/email/mailer.ts`
- Create: `src/infra/email/templates.ts`
- Create: `src/features/subscriptions/repository.ts`
- Create: `src/features/subscriptions/service.ts`
- Create: `src/features/subscriptions/service.test.ts`
- Create: `src/features/subscriptions/schemas.ts`
- Create: `src/features/subscriptions/routes.ts`
- Create: `src/features/subscriptions/routes.test.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Write failing unit tests for repo parsing and subscribe service behavior**

Cover:
- rejects repo strings that are not `owner/repo`
- rejects duplicates
- creates a pending subscription with tokens
- sends a confirmation email
- raises a typed error when GitHub says the repo does not exist
- raises a typed error when GitHub is rate limited

- [ ] **Step 2: Write failing route tests with `inject()`**

Cover:
- `400` for invalid request body
- `400` for invalid repo format
- `404` for nonexistent GitHub repo
- `409` for already subscribed email/repo pair
- `200` for successful subscribe

Use the app factory with mocked GitHub client and mocked mailer so the route tests stay deterministic. Prefer Vitest mocks (`vi.fn()`, `vi.spyOn()`) over hand-rolled stubs unless a simple object literal is clearer.

- [ ] **Step 3: Implement repo parsing in `repo-ref.ts`**

Create a small parser that:
- trims the input
- validates exactly one slash
- rejects empty owner or repo segments
- returns a normalized `repoFullName`

- [ ] **Step 4: Implement the GitHub client**

`src/features/github/client.ts` should expose:
- `assertRepositoryExists(repoFullName)`

Implementation notes:
- call GitHub REST API with `fetch`
- send `Authorization` only when `GITHUB_TOKEN` is present
- convert `404` and `429` into typed errors
- log response metadata, not secrets

- [ ] **Step 5: Implement the mailer abstraction**

`src/infra/email/mailer.ts` should expose a tiny interface such as:
- `sendConfirmationEmail(...)`
- `sendReleaseEmail(...)`

The first implementation should use Nodemailer SMTP transport.

`src/infra/email/templates.ts` should build plain-text messages with confirm and unsubscribe links from `APP_BASE_URL`.

- [ ] **Step 6: Implement the subscription repository**

Repository responsibilities:
- create or upsert repository row
- find active subscription by email and repo
- insert pending subscription
- fetch by confirmation token
- mark subscription confirmed
- list active subscriptions by email
- fetch by unsubscribe token
- mark subscription unsubscribed

- [ ] **Step 7: Implement the subscribe service**

Service flow:
1. validate repo format
2. verify repository exists on GitHub
3. check for duplicate active subscription
4. ensure `repositories` row exists
5. create pending subscription with UUID tokens
6. send confirmation email

- [ ] **Step 8: Register the `/api/subscribe` route**

Use a TypeBox body schema matching `swagger.yaml`:
- `email: string`
- `repo: string`

Do not change request or response contract.

- [ ] **Step 9: Verify the subscribe slice**

Run:
- `pnpm lint`
- `pnpm typecheck`
- `pnpm exec vitest run src/features/github/client.test.ts`
- `pnpm exec vitest run src/features/subscriptions/service.test.ts`
- `pnpm exec vitest run src/features/subscriptions/routes.test.ts`

- [ ] **Step 10: Commit**

Commit: `git commit -m "feat: add subscription creation flow"`

### Task 4: Implement `GET /api/confirm/{token}`

**Required skills:**
- `node` for token handling and service logic
- `fastify-best-practices` for route validation and response handling
- `typescript-magician` for all `.ts` files in this task

**Files:**
- Modify: `src/features/subscriptions/service.ts`
- Modify: `src/features/subscriptions/service.test.ts`
- Modify: `src/features/subscriptions/schemas.ts`
- Modify: `src/features/subscriptions/routes.ts`
- Modify: `src/features/subscriptions/routes.test.ts`

- [ ] **Step 1: Write failing tests for confirmation flow**

Cover:
- `400` when token shape is invalid
- `404` when token is valid but missing
- `200` when pending subscription becomes confirmed
- idempotency choice: a second confirm for the same token should remain predictable and documented in tests

- [ ] **Step 2: Implement `confirmSubscription(token)`**

Use UUID validation before the database lookup so invalid tokens return `400` and unknown tokens return `404`.

- [ ] **Step 3: Register `GET /api/confirm/:token`**

Use a path schema with `token` as UUID. Keep the route under the `/api` prefix so the final URL is `/api/confirm/{token}`.

- [ ] **Step 4: Verify the confirmation slice**

Run:
- `pnpm lint`
- `pnpm typecheck`
- `pnpm exec vitest run src/features/subscriptions/service.test.ts`
- `pnpm exec vitest run src/features/subscriptions/routes.test.ts`

- [ ] **Step 5: Commit**

Commit: `git commit -m "feat: add subscription confirmation endpoint"`

### Task 5: Implement `GET /api/subscriptions?email=...`

**Required skills:**
- `node` for service/query behavior
- `fastify-best-practices` for query validation, route definition, and API tests
- `typescript-magician` for all `.ts` files in this task

**Files:**
- Modify: `src/features/subscriptions/repository.ts`
- Modify: `src/features/subscriptions/service.ts`
- Modify: `src/features/subscriptions/service.test.ts`
- Modify: `src/features/subscriptions/schemas.ts`
- Modify: `src/features/subscriptions/routes.ts`
- Modify: `src/features/subscriptions/routes.test.ts`

- [ ] **Step 1: Write failing tests for listing subscriptions**

Cover:
- `400` for invalid email query
- returns only active subscriptions
- includes `confirmed`
- includes `last_seen_tag`

- [ ] **Step 2: Implement repository query for active subscriptions by email**

Join `subscriptions` with `repositories` and return rows shaped for the Swagger `Subscription` object.

- [ ] **Step 3: Implement `getSubscriptionsByEmail(email)`**

Service should stay thin here: validate business assumptions, delegate retrieval to the repository, and return the exact response shape required by Swagger.

- [ ] **Step 4: Register `GET /api/subscriptions`**

Use query validation with `email` format and return an array response schema.

- [ ] **Step 5: Verify the listing slice**

Run:
- `pnpm lint`
- `pnpm typecheck`
- `pnpm exec vitest run src/features/subscriptions/service.test.ts`
- `pnpm exec vitest run src/features/subscriptions/routes.test.ts`

- [ ] **Step 6: Commit**

Commit: `git commit -m "feat: add subscriptions lookup endpoint"`

### Task 6: Implement `GET /api/unsubscribe/{token}`

**Required skills:**
- `node` for token handling and service behavior
- `fastify-best-practices` for route validation, handler structure, and API tests
- `typescript-magician` for all `.ts` files in this task

**Files:**
- Modify: `src/features/subscriptions/repository.ts`
- Modify: `src/features/subscriptions/service.ts`
- Modify: `src/features/subscriptions/service.test.ts`
- Modify: `src/features/subscriptions/schemas.ts`
- Modify: `src/features/subscriptions/routes.ts`
- Modify: `src/features/subscriptions/routes.test.ts`

- [ ] **Step 1: Write failing tests for unsubscribe behavior**

Cover:
- `400` for invalid token shape
- `404` for unknown token
- `200` for successful unsubscribe
- unsubscribed records no longer appear in `GET /api/subscriptions`

- [ ] **Step 2: Implement `unsubscribe(token)`**

Use soft delete via `unsubscribed_at` so history is preserved and duplicate re-subscription remains possible later.

- [ ] **Step 3: Register `GET /api/unsubscribe/:token`**

Use the same UUID validation strategy as confirmation.

- [ ] **Step 4: Verify the unsubscribe slice**

Run:
- `pnpm lint`
- `pnpm typecheck`
- `pnpm exec vitest run src/features/subscriptions/service.test.ts`
- `pnpm exec vitest run src/features/subscriptions/routes.test.ts`

- [ ] **Step 5: Commit**

Commit: `git commit -m "feat: add unsubscribe endpoint"`

### Task 7: Implement release scanning and notifications

**Required skills:**
- `node` for scheduler behavior, GitHub polling, mailer flow, and graceful async execution
- `fastify-best-practices` for app wiring and any Fastify integration points
- `typescript-magician` for all `.ts` files in this task

**Files:**
- Create: `src/features/releases/repository.ts`
- Create: `src/features/releases/scanner.ts`
- Create: `src/features/releases/scanner.test.ts`
- Create: `src/features/releases/scheduler.ts`
- Modify: `src/features/github/client.ts`
- Modify: `src/features/github/client.test.ts`
- Modify: `src/infra/email/templates.ts`
- Modify: `src/infra/email/mailer.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Write failing unit tests for release scanning**

Cover:
- baseline scan stores `last_seen_tag` and sends no email
- unchanged tag sends no email
- changed tag updates `last_seen_tag` and sends emails to confirmed active subscribers
- repositories with no releases do not crash the scanner
- GitHub `429` does not break the whole scan loop

- [ ] **Step 2: Extend the GitHub client with latest-release lookup**

Add:
- `getLatestReleaseTag(repoFullName)`

Convert GitHub outcomes into typed results:
- latest tag string
- no release yet
- repo missing
- rate limited

- [ ] **Step 3: Implement the release repository**

Repository responsibilities:
- list repositories with active confirmed subscriptions
- get `last_seen_tag`
- update `last_seen_tag`
- list confirmed active subscribers for a repo

- [ ] **Step 4: Implement the scanner service**

`src/features/releases/scanner.ts` should expose a single entrypoint such as `scanAllRepositories()`.

Behavior:
- iterate active repositories sequentially or with very small concurrency
- fetch latest release tag
- set baseline when `last_seen_tag` is empty
- notify only when the tag changes
- keep scanning other repositories even if one fails

- [ ] **Step 5: Implement the scheduler**

`src/features/releases/scheduler.ts` should start a `setInterval` loop after app startup using `SCAN_INTERVAL_MS`, guard against overlapping runs, and clear the timer in an `onClose` hook.

- [ ] **Step 6: Add release email content**

Release emails should include:
- repository name
- new tag
- unsubscribe link

- [ ] **Step 7: Verify the scanner slice**

Run:
- `pnpm lint`
- `pnpm typecheck`
- `pnpm exec vitest run src/features/github/client.test.ts`
- `pnpm exec vitest run src/features/releases/scanner.test.ts`
- `pnpm exec vitest run src/features/subscriptions/service.test.ts`

- [ ] **Step 8: Commit**

Commit: `git commit -m "feat: add release scanning and notifications"`

### Task 8: Docker packaging, docs, and final verification

**Required skills:**
- `node` if any runtime scripts or startup behavior are adjusted while finishing this task
- `linting-neostandard-eslint9` if `eslint.config.js` or lint scripts change during cleanup
- `typescript-magician` for any TypeScript file touched during final cleanup

**Files:**
- Create: `.dockerignore`
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `README.md`
- Modify: `.env.example`

- [ ] **Step 1: Create `.dockerignore`**

Ignore:
- `node_modules`
- `.git`
- coverage artifacts
- local env files

- [ ] **Step 2: Create `Dockerfile`**

Use a Node 24 image and run the app with `node src/server.ts`. Keep the image simple; no build step is needed for native TypeScript execution.

- [ ] **Step 3: Create `docker-compose.yml`**

Services:
- `app`
- `postgres`
- `mailpit`

Compose requirements:
- pass env vars into the app
- persist Postgres data
- expose API port and Mailpit UI port
- ensure the app waits for Postgres readiness or retries cleanly

- [ ] **Step 4: Document local setup and architecture**

`README.md` should cover:
- required environment variables
- how to run locally
- how to run tests and linting
- Docker usage
- how confirmation and release scanning work
- the explicit note that `swagger.yaml` is the contract source

- [ ] **Step 5: Final verification**

Run:
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `docker compose up --build`

After containers are up, manually smoke test:
- `POST /api/subscribe`
- `GET /api/confirm/{token}`
- `GET /api/subscriptions?email=...`
- `GET /api/unsubscribe/{token}`

- [ ] **Step 6: Commit**

Commit: `git commit -m "chore: add docker setup and project docs"`

## Non-goals until baseline is complete

- Redis caching
- HTML subscription page
- API key auth
- Prometheus metrics
- GitHub Actions CI
- gRPC interface

These can be planned only after the required assignment scope is working and verified.
