# EJS Static XP Start Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hand-built public HTML with EJS templates, static CSS/JS assets, a background image, and a vanilla JavaScript XP-style taskbar/start menu.

**Architecture:** Keep one Fastify monolith. Register official Fastify plugins for views and static assets, render public pages with EJS, keep form submission server-rendered, and add a public non-API JSON lookup route for browser start-menu subscriptions. The browser script is a progressive enhancement layer only.

**Tech Stack:** Node 24 native TypeScript, Fastify 5, `@fastify/view`, EJS, `@fastify/static`, vanilla browser JavaScript, Vitest `inject()` route tests, neostandard/ESLint 9.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-04-12-ejs-static-xp-start-menu-design.md`
- Fixed API contract: `swagger.yaml`
- Assignment notes: `task.md`
- Repo instructions: `AGENTS.md`

## Required Skills

- @node for Node 24 native TypeScript, package scripts, static files, and runtime behavior.
- @fastify-best-practices for Fastify plugins, route registration, validation, and `inject()` tests.
- @typescript-magician for typed route query/body handling and avoiding unsafe casts.
- @linting-neostandard-eslint9 if lint config, lint failures, or pre-commit hook issues are touched.
- @test-driven-development for every production behavior change.
- @verification-before-completion before claiming the implementation is complete.

## Current Git Caveats

At plan creation time:

- `src/features/github/client.ts` is intentionally staged by the user and must not be unstaged or overwritten.
- `static/images/bg.jpg` exists and is untracked. Treat it as a user-provided asset and add it only when implementing static assets.
- The pre-commit hook failed because `neostandard` attempted to `require()` ESM-only `find-up`. Do not fix that as part of this UI plan unless the user explicitly expands scope.

## File Structure

- Modify `package.json`: add runtime dependencies `@fastify/view`, `@fastify/static`, and `ejs`.
- Modify `pnpm-lock.yaml`: dependency lock updates from `pnpm add`.
- Modify `src/app.ts`: register static asset serving and view rendering before public web routes.
- Modify `src/features/web/routes.ts`: switch from string render helpers to `reply.viewAsync`, add public `GET /subscriptions`.
- Delete `src/features/web/templates.ts`: no longer needed after EJS migration.
- Create `src/features/web/views/layout.ejs`: shared HTML shell, taskbar/start menu markup, asset includes.
- Create `src/features/web/views/home.ejs`: home page content and form fields.
- Create `src/features/web/views/token-result.ejs`: confirmation/unsubscribe result content.
- Modify `src/features/web/routes.test.ts`: cover EJS-rendered pages, static links, public lookup route, and form behavior.
- Modify `src/features/subscriptions/routes.test.ts`: add or keep assertion that protected `/api/subscriptions` still requires an API key.
- Create `static/styles/app.css`: XP window, taskbar, start menu, background image, responsive styles, preference classes.
- Create `static/scripts/app.js`: vanilla progressive enhancement for form email storage, clock, start menu, panels, preferences, and subscription loading.
- Add `static/images/bg.jpg`: existing provided background asset.

---

## Task 1: Add View And Static Dependencies

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Install dependencies**

Run:

```bash
pnpm add @fastify/view @fastify/static ejs
```

Expected:

- `package.json` gains `@fastify/view`, `@fastify/static`, and `ejs` under `dependencies`.
- `pnpm-lock.yaml` updates.

- [ ] **Step 2: Verify package scripts still resolve**

Run:

```bash
pnpm typecheck
```

Expected:

- TypeScript may still pass because the new packages are not used yet.
- If it fails only because dependencies were not installed, fix the install before continuing.

- [ ] **Step 3: Commit dependency update**

Stage only dependency files:

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add web view dependencies"
```

If the existing pre-commit neostandard/fetch-up ESM issue blocks the commit, report it and ask whether to use `--no-verify`. Do not broaden scope to fix lint tooling unless asked.

---

## Task 2: Register Static And View Plugins

**Files:**
- Modify: `src/app.ts`
- Test: `src/features/web/routes.test.ts`

- [ ] **Step 1: Write failing static asset tests**

Add tests to `src/features/web/routes.test.ts`:

```ts
it('serves the public stylesheet', async () => {
  const app = buildApp({}, {
    web: {
      service: createServiceStub()
    }
  })
  await app.ready()

  const response = await app.inject({
    method: 'GET',
    url: '/assets/styles/app.css'
  })

  expect(response.statusCode).toBe(200)
  expect(response.headers['content-type']).toContain('text/css')
  await app.close()
})

it('serves the browser script', async () => {
  const app = buildApp({}, {
    web: {
      service: createServiceStub()
    }
  })
  await app.ready()

  const response = await app.inject({
    method: 'GET',
    url: '/assets/scripts/app.js'
  })

  expect(response.statusCode).toBe(200)
  expect(response.headers['content-type']).toContain('javascript')
  await app.close()
})

it('serves the background image', async () => {
  const app = buildApp({}, {
    web: {
      service: createServiceStub()
    }
  })
  await app.ready()

  const response = await app.inject({
    method: 'GET',
    url: '/assets/images/bg.jpg'
  })

  expect(response.statusCode).toBe(200)
  expect(response.headers['content-type']).toContain('image/jpeg')
  await app.close()
})
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
pnpm test -- src/features/web/routes.test.ts
```

Expected:

- Static asset tests fail with `404`.

- [ ] **Step 3: Register `@fastify/static` and `@fastify/view`**

Update `src/app.ts`:

```ts
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import fastifyStatic from '@fastify/static'
import fastifyView from '@fastify/view'
import ejs from 'ejs'
```

Add near the top of the module:

```ts
const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(dirname, '..')
```

Register plugins before `webRoutes`:

```ts
app.register(fastifyStatic, {
  prefix: '/assets/',
  root: path.join(rootDir, 'static')
})
app.register(fastifyView, {
  engine: {
    ejs
  },
  root: path.join(dirname, 'features/web/views')
})
```

Keep `fastifyFormbody` before `webRoutes`.

- [ ] **Step 4: Add placeholder static files**

Create enough content for tests to pass:

```text
static/styles/app.css
static/scripts/app.js
```

Initial `static/styles/app.css`:

```css
body {
  margin: 0;
}
```

Initial `static/scripts/app.js`:

```js
console.log('Release Notifier XP ready')
```

Do not create or overwrite `static/images/bg.jpg`; use the existing user-provided asset.

- [ ] **Step 5: Run tests and verify pass**

Run:

```bash
pnpm test -- src/features/web/routes.test.ts
```

Expected:

- Static asset tests pass.
- Existing public web route tests still pass until EJS migration begins.

- [ ] **Step 6: Commit static/view plugin registration**

```bash
git add package.json pnpm-lock.yaml src/app.ts src/features/web/routes.test.ts static/styles/app.css static/scripts/app.js static/images/bg.jpg
git commit -m "feat: serve web static assets"
```

If `package.json`/`pnpm-lock.yaml` were already committed in Task 1, omit them from `git add`.

---

## Task 3: Migrate Public Pages To EJS

**Files:**
- Modify: `src/features/web/routes.ts`
- Delete: `src/features/web/templates.ts`
- Create: `src/features/web/views/layout.ejs`
- Create: `src/features/web/views/home.ejs`
- Create: `src/features/web/views/token-result.ejs`
- Test: `src/features/web/routes.test.ts`
- Test: `src/app.test.ts`

- [ ] **Step 1: Write failing HTML asset-link tests**

Update the existing `GET /` test in `src/features/web/routes.test.ts` to assert:

```ts
expect(response.body).toContain('href="/assets/styles/app.css"')
expect(response.body).toContain('src="/assets/scripts/app.js"')
expect(response.body).toContain('id="xp-taskbar"')
expect(response.body).toContain('id="xp-start-menu"')
```

Also keep existing assertions for:

- `Release Notifier XP`
- `Repository`
- `Email`
- `Start Watching`
- `Status`

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
pnpm test -- src/features/web/routes.test.ts src/app.test.ts
```

Expected:

- The new asset-link/taskbar assertions fail because pages still come from `templates.ts`.

- [ ] **Step 3: Create `layout.ejs`**

Create `src/features/web/views/layout.ejs`:

```ejs
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><%= title %></title>
  <link rel="stylesheet" href="/assets/styles/app.css">
  <script type="module" src="/assets/scripts/app.js"></script>
</head>
<body>
  <main class="desktop">
    <%- body %>
  </main>
  <aside class="start-menu" id="xp-start-menu" hidden>
    <div class="start-menu__header">
      <strong>Release Notifier XP</strong>
      <span data-start-email>No email saved</span>
    </div>
    <nav class="start-menu__nav" aria-label="Start menu">
      <button type="button" data-panel-trigger="subscriptions">My Subscriptions</button>
      <button type="button" data-panel-trigger="account">Account</button>
      <button type="button" data-panel-trigger="preferences">Preferences</button>
      <button type="button" data-panel-trigger="about">About</button>
    </nav>
    <section class="start-panel" data-panel="subscriptions">
      <h2>My Subscriptions</h2>
      <p data-subscription-summary>Save an email, then load subscriptions.</p>
      <label for="menu-email">Email</label>
      <input id="menu-email" name="menu-email" type="email" autocomplete="email">
      <button type="button" data-save-email>Save email</button>
      <button type="button" data-load-subscriptions>Load subscriptions</button>
      <div class="subscription-list" data-subscription-list></div>
    </section>
    <section class="start-panel" data-panel="account" hidden>
      <h2>Account</h2>
      <p data-account-summary>No saved email yet.</p>
      <label for="account-email">Saved email</label>
      <input id="account-email" name="account-email" type="email" autocomplete="email">
      <button type="button" data-save-account>Email looks right</button>
      <button type="button" data-clear-email>Clear email</button>
      <button type="button" data-clear-local-data>Clear local data</button>
    </section>
    <section class="start-panel" data-panel="preferences" hidden>
      <h2>Preferences</h2>
      <label>
        Clock format
        <select data-preference="clockFormat">
          <option value="24">24-hour</option>
          <option value="12">12-hour</option>
        </select>
      </label>
      <label>
        Background dim
        <select data-preference="backgroundDim">
          <option value="normal">Normal</option>
          <option value="strong">Stronger</option>
        </select>
      </label>
      <label>
        Motion
        <select data-preference="motion">
          <option value="normal">Normal</option>
          <option value="reduced">Reduced</option>
        </select>
      </label>
      <label>
        Menu density
        <select data-preference="density">
          <option value="cozy">Cozy</option>
          <option value="compact">Compact</option>
        </select>
      </label>
    </section>
    <section class="start-panel" data-panel="about" hidden>
      <h2>About</h2>
      <p>Subscriptions start after email confirmation. Pending repos may appear until confirmed.</p>
      <p>Unsubscribe links arrive by email. This taskbar stores only local browser preferences and a saved email.</p>
    </section>
  </aside>
  <footer class="taskbar" id="xp-taskbar">
    <button class="start-button" type="button" aria-controls="xp-start-menu" aria-expanded="false" data-start-button>Start</button>
    <div class="taskbar__tray">
      <span data-clock>--:--</span>
    </div>
  </footer>
</body>
</html>
```

The `<%- body %>` slot is trusted because it is rendered from app-controlled EJS views only.

- [ ] **Step 4: Create page views**

Create `src/features/web/views/home.ejs`:

```ejs
<section class="window" aria-label="Release Notifier XP">
  <div class="title-bar">
    <span>Release Notifier XP</span>
    <span class="window-buttons" aria-hidden="true">
      <span class="window-button">_</span>
      <span class="window-button">x</span>
    </span>
  </div>
  <div class="window-body">
    <div class="masthead">
      <img class="brand-icon" src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png" alt="GitHub mark">
      <div>
        <h1>Release Notifier XP</h1>
        <p>Track a GitHub repo. Get a tiny electronic postcard when it ships.</p>
      </div>
    </div>
    <form action="/subscribe" method="post" data-subscribe-form>
      <label for="repo">Repository</label>
      <input id="repo" name="repo" type="text" autocomplete="off" placeholder="nodejs/node" value="<%= values.repo ?? '' %>" required>
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="email" placeholder="you@example.com" value="<%= values.email ?? '' %>" required>
      <button type="submit">Start Watching</button>
    </form>
    <div class="status" data-kind="<%= status.kind %>" role="status">
      <strong>Status</strong>
      <span><%= status.message %></span>
    </div>
  </div>
</section>
```

Create `src/features/web/views/token-result.ejs`:

```ejs
<section class="window" aria-label="Release Notifier XP">
  <div class="title-bar">
    <span>Release Notifier XP</span>
    <span class="window-buttons" aria-hidden="true">
      <span class="window-button">_</span>
      <span class="window-button">x</span>
    </span>
  </div>
  <div class="window-body">
    <div class="masthead">
      <img class="brand-icon" src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png" alt="GitHub mark">
      <div>
        <h1><%= heading %></h1>
        <p><%= message %></p>
      </div>
    </div>
    <div class="status" data-kind="<%= state === 'success' ? 'success' : 'error' %>" role="status">
      <strong>Status</strong>
      <span><%= state === 'success' ? 'All set.' : 'Needs attention.' %></span>
    </div>
    <p class="token-actions"><a href="/">Back to Release Notifier XP</a></p>
  </div>
</section>
```

- [ ] **Step 5: Add typed render helpers in `routes.ts`**

Remove imports from `./templates.ts`.

Add local types:

```ts
type HomePageStatus = {
  kind: 'error' | 'idle' | 'success'
  message: string
}

type HomePageValues = Partial<{
  email: string
  repo: string
}>
```

Add helper:

```ts
async function renderLayout (
  reply: Parameters<Parameters<typeof webRoutesPlugin>[2]>[1],
  template: string,
  data: Record<string, unknown>
) {
  const body = await reply.viewAsync(template, data)

  return await reply
    .type('text/html')
    .viewAsync('layout.ejs', {
      body,
      title: data.title
    })
}
```

If the helper type is awkward, use `FastifyReply` imported as a type from `fastify`:

```ts
async function renderLayout (
  reply: FastifyReply,
  template: string,
  data: Record<string, unknown>
) {
  const body = await reply.viewAsync(template, data)

  return await reply
    .type('text/html')
    .viewAsync('layout.ejs', {
      body,
      title: data.title
    })
}
```

Update `GET /`:

```ts
return await renderLayout(reply, 'home.ejs', {
  status: {
    kind: 'idle',
    message: 'Standing by for a repository and inbox.'
  },
  title: 'Release Notifier XP',
  values: {}
})
```

Update successful `POST /subscribe`:

```ts
return await renderLayout(reply, 'home.ejs', {
  status: {
    kind: 'success',
    message: 'Inbox armed. Check your email to confirm the subscription.'
  },
  title: 'Release Notifier XP',
  values: body
})
```

Update form error render similarly with `kind: 'error'`.

Update token routes to call `renderLayout(reply, 'token-result.ejs', ...)`.

- [ ] **Step 6: Delete old string template module**

Delete:

```text
src/features/web/templates.ts
```

Run:

```bash
rg "templates\\.ts|renderHomePage|renderTokenResultPage" src
```

Expected:

- No matches.

- [ ] **Step 7: Run tests and typecheck**

Run:

```bash
pnpm test -- src/features/web/routes.test.ts src/app.test.ts
pnpm typecheck
```

Expected:

- Web route tests pass.
- App smoke test still finds `Release Notifier XP`.
- Typecheck passes.

- [ ] **Step 8: Commit EJS migration**

```bash
git add src/app.ts src/features/web/routes.ts src/features/web/routes.test.ts src/app.test.ts src/features/web/views src/features/web/templates.ts
git commit -m "feat: render web pages with ejs"
```

---

## Task 4: Add Public Subscription Lookup Route

**Files:**
- Modify: `src/features/web/routes.ts`
- Modify: `src/features/web/routes.test.ts`
- Modify: `src/features/subscriptions/routes.test.ts`

- [ ] **Step 1: Write failing public lookup tests**

Add to `src/features/web/routes.test.ts`:

```ts
const listedSubscriptions = [
  {
    confirmed: true,
    email: 'user@example.com',
    last_seen_tag: 'v1.0.0',
    repo: 'nodejs/node'
  }
]

it('returns subscriptions by email without an API key for the start menu', async () => {
  const service = createServiceStub()
  service.getSubscriptionsByEmail = vi.fn(() => Promise.resolve(listedSubscriptions))
  const app = buildApp({}, {
    web: {
      service
    }
  })
  await app.ready()

  const response = await app.inject({
    method: 'GET',
    url: '/subscriptions?email=user@example.com'
  })

  expect(response.statusCode).toBe(200)
  expect(response.json()).toEqual(listedSubscriptions)
  expect(service.getSubscriptionsByEmail).toHaveBeenCalledWith('user@example.com')
  await app.close()
})

it('rejects invalid public subscription lookup emails', async () => {
  const service = createServiceStub()
  const app = buildApp({}, {
    web: {
      service
    }
  })
  await app.ready()

  const response = await app.inject({
    method: 'GET',
    url: '/subscriptions?email=not-an-email'
  })

  expect(response.statusCode).toBe(400)
  expect(service.getSubscriptionsByEmail).not.toHaveBeenCalled()
  await app.close()
})
```

Add or keep a protected API guard test in `src/features/subscriptions/routes.test.ts`:

```ts
it('requires an API key for protected subscription lookups', async () => {
  const service = createServiceStub()
  const app = buildApp({}, {
    subscriptions: {
      service
    }
  })

  await app.ready()

  const response = await app.inject({
    method: 'GET',
    url: '/api/subscriptions?email=user@example.com'
  })

  expect(response.statusCode).toBe(401)
  expect(service.getSubscriptionsByEmail).not.toHaveBeenCalled()

  await app.close()
})
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
pnpm test -- src/features/web/routes.test.ts src/features/subscriptions/routes.test.ts
```

Expected:

- Public lookup tests fail with `404`.
- Protected API-key test passes if already implemented, or fails until added/fixed.

- [ ] **Step 3: Implement email query parsing**

In `src/features/web/routes.ts`, add:

```ts
type SubscriptionsQuery = {
  email?: string
}

function readEmailQuery (query: unknown): string | null {
  if (typeof query !== 'object' || query === null || !('email' in query)) {
    return null
  }

  const email = (query as SubscriptionsQuery).email

  if (typeof email !== 'string') {
    return null
  }

  return email
}

function isEmailLike (email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
```

If TypeScript complains about the cast, replace with a safer local `Record<string, unknown>` narrowing.

- [ ] **Step 4: Add public lookup route**

Inside `webRoutesPlugin`:

```ts
fastify.get('/subscriptions', async (request, reply) => {
  const email = readEmailQuery(request.query)

  if (email === null || !isEmailLike(email)) {
    return await reply.code(400).send({
      error: 'BAD_REQUEST',
      message: 'A valid email query is required',
      statusCode: 400
    })
  }

  const subscriptions = await service.getSubscriptionsByEmail(email)

  return await reply.code(200).send(subscriptions)
})
```

Do not register this route under `/api`.

- [ ] **Step 5: Run tests and verify pass**

Run:

```bash
pnpm test -- src/features/web/routes.test.ts src/features/subscriptions/routes.test.ts
pnpm typecheck
```

Expected:

- Public lookup works without `x-api-key`.
- Protected `/api/subscriptions` still requires `x-api-key`.
- Typecheck passes.

- [ ] **Step 6: Commit public lookup route**

```bash
git add src/features/web/routes.ts src/features/web/routes.test.ts src/features/subscriptions/routes.test.ts
git commit -m "feat: add public subscription lookup for web"
```

---

## Task 5: Build XP Styles

**Files:**
- Modify: `static/styles/app.css`
- Test: `src/features/web/routes.test.ts`

- [ ] **Step 1: Add route assertions for background asset references**

In the existing `GET /` test, assert:

```ts
expect(response.body).toContain('/assets/styles/app.css')
expect(response.body).toContain('/assets/scripts/app.js')
```

The asset route tests from Task 2 already prove the CSS file itself is served.

- [ ] **Step 2: Replace placeholder CSS**

Update `static/styles/app.css` with focused XP styling:

```css
* {
  box-sizing: border-box;
}

:root {
  color-scheme: light;
  --taskbar-height: 42px;
  --window-bg: #ece9d8;
  --window-blue: #075ad8;
  --window-blue-light: #2f8cff;
  --focus: #f7d84a;
  --text: #161616;
}

body {
  min-height: 100vh;
  margin: 0;
  overflow-x: hidden;
  font-family: Tahoma, Verdana, Arial, sans-serif;
  color: var(--text);
  background-image:
    linear-gradient(rgba(0, 0, 0, 0.24), rgba(0, 0, 0, 0.24)),
    url("/assets/images/bg.jpg");
  background-position: center;
  background-size: cover;
}

body[data-background-dim="strong"] {
  background-image:
    linear-gradient(rgba(0, 0, 0, 0.44), rgba(0, 0, 0, 0.44)),
    url("/assets/images/bg.jpg");
}

button,
input,
select {
  font: inherit;
}

a {
  color: #034fa2;
}

button:focus-visible,
input:focus-visible,
select:focus-visible,
a:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 2px;
}

.desktop {
  display: grid;
  min-height: 100vh;
  padding: 32px 16px calc(var(--taskbar-height) + 28px);
  place-items: center;
}

.window {
  width: min(100%, 640px);
  overflow: hidden;
  border: 2px solid #0f3f9f;
  border-radius: 6px;
  background: var(--window-bg);
  box-shadow: 6px 8px 0 rgba(0, 0, 0, 0.34);
}

.title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 7px 10px;
  background: linear-gradient(180deg, var(--window-blue-light), var(--window-blue));
  color: #fff;
  font-weight: 700;
}

.window-buttons {
  display: flex;
  gap: 4px;
}

.window-button {
  width: 18px;
  height: 18px;
  border: 1px solid #fff;
  border-radius: 3px;
  background: #dbe8ff;
  color: #0f3f9f;
  line-height: 15px;
  text-align: center;
}

.window-body {
  padding: 22px;
}

.masthead {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 14px;
  align-items: center;
  margin-bottom: 22px;
}

.brand-icon {
  width: 48px;
  height: 48px;
  padding: 7px;
  border: 1px solid #8a866a;
  border-radius: 6px;
  background: #fff;
}

h1,
h2,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 6px;
  font-size: 1.75rem;
}

p {
  line-height: 1.5;
}

form {
  display: grid;
  gap: 14px;
}

label {
  display: grid;
  gap: 6px;
  font-weight: 700;
}

input,
select {
  width: 100%;
  border: 2px inset #fff;
  border-radius: 4px;
  padding: 10px;
  background: #fff;
  color: var(--text);
}

button {
  justify-self: start;
  border: 1px solid #4b4b4b;
  border-radius: 4px;
  padding: 9px 16px;
  background: linear-gradient(180deg, #fffef6, #d7d2bc);
  color: var(--text);
  font-weight: 700;
  cursor: pointer;
}

.status {
  margin-top: 18px;
  border: 1px solid #8a866a;
  border-radius: 6px;
  padding: 12px;
  background: #fffef6;
}

.status strong {
  display: block;
  margin-bottom: 4px;
}

.status[data-kind="success"] {
  border-color: #2b6c2a;
}

.status[data-kind="error"] {
  border-color: #9f2e1a;
}

.token-actions {
  margin-top: 18px;
}

.taskbar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: var(--taskbar-height);
  padding: 4px 8px;
  border-top: 1px solid #4f8df7;
  background: linear-gradient(180deg, #2d8cff, #0350c8 58%, #023aa0);
  color: #fff;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.35);
}

.start-button {
  min-width: 84px;
  border-color: #134f13;
  border-radius: 8px;
  background: linear-gradient(180deg, #4fca4f, #168f16);
  color: #fff;
  text-shadow: 1px 1px 0 #064f06;
}

.taskbar__tray {
  border: 1px inset rgba(255, 255, 255, 0.45);
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.18);
  font-variant-numeric: tabular-nums;
}

.start-menu {
  position: fixed;
  bottom: calc(var(--taskbar-height) + 6px);
  left: 8px;
  z-index: 30;
  width: min(92vw, 430px);
  max-height: min(76vh, 620px);
  overflow: auto;
  border: 2px solid #0f3f9f;
  border-radius: 8px;
  background: var(--window-bg);
  box-shadow: 8px 10px 0 rgba(0, 0, 0, 0.34);
}

.start-menu[hidden] {
  display: none;
}

.start-menu__header {
  padding: 12px;
  background: linear-gradient(180deg, var(--window-blue-light), var(--window-blue));
  color: #fff;
}

.start-menu__header span {
  display: block;
  margin-top: 4px;
  font-size: 0.9rem;
}

.start-menu__nav {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 10px;
}

.start-menu__nav button[aria-current="true"] {
  border-color: #0f3f9f;
  background: #fff;
}

.start-panel {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-top: 1px solid #c3bea5;
}

.start-panel[hidden] {
  display: none;
}

.subscription-list {
  display: grid;
  gap: 8px;
}

.subscription-item {
  border: 1px solid #8a866a;
  border-radius: 6px;
  padding: 10px;
  background: #fffef6;
}

.subscription-item strong {
  display: block;
}

.subscription-meta {
  margin: 4px 0 0;
  color: #474747;
  font-size: 0.94rem;
}

body[data-density="compact"] .start-panel,
body[data-density="compact"] .start-menu__nav {
  gap: 6px;
  padding: 8px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
  }
}

@media (max-width: 520px) {
  .desktop {
    align-items: start;
    padding: 16px 10px calc(var(--taskbar-height) + 18px);
  }

  .window-body {
    padding: 16px;
  }

  .masthead {
    grid-template-columns: 1fr;
  }

  .brand-icon {
    width: 42px;
    height: 42px;
  }

  .start-menu {
    right: 8px;
    width: auto;
  }
}
```

- [ ] **Step 3: Run route/static tests**

Run:

```bash
pnpm test -- src/features/web/routes.test.ts
```

Expected:

- All web route/static tests pass.

- [ ] **Step 4: Commit CSS**

```bash
git add static/styles/app.css src/features/web/routes.test.ts
git commit -m "feat: style xp web interface"
```

---

## Task 6: Implement Vanilla Start Menu Script

**Files:**
- Modify: `static/scripts/app.js`
- Test: `src/features/web/routes.test.ts`

- [ ] **Step 1: Add static script smoke assertion**

Update the browser script static asset test:

```ts
expect(response.body).toContain('localStorage')
expect(response.body).toContain('Load subscriptions')
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
pnpm test -- src/features/web/routes.test.ts
```

Expected:

- Script content assertions fail while `app.js` is still the placeholder.

- [ ] **Step 3: Replace `static/scripts/app.js`**

Use vanilla browser JavaScript. Keep it framework-free and use safe DOM APIs:

```js
const storageKeys = {
  email: 'releaseNotifier.email',
  preferences: 'releaseNotifier.preferences'
}

const defaultPreferences = {
  backgroundDim: 'normal',
  clockFormat: '24',
  density: 'cozy',
  motion: 'normal'
}

const elements = {
  accountEmail: document.querySelector('#account-email'),
  accountSummary: document.querySelector('[data-account-summary]'),
  clearEmail: document.querySelector('[data-clear-email]'),
  clearLocalData: document.querySelector('[data-clear-local-data]'),
  clock: document.querySelector('[data-clock]'),
  loadSubscriptions: document.querySelector('[data-load-subscriptions]'),
  menu: document.querySelector('#xp-start-menu'),
  menuEmail: document.querySelector('#menu-email'),
  panels: document.querySelectorAll('[data-panel]'),
  preferenceControls: document.querySelectorAll('[data-preference]'),
  saveAccount: document.querySelector('[data-save-account]'),
  saveEmail: document.querySelector('[data-save-email]'),
  startButton: document.querySelector('[data-start-button]'),
  startEmail: document.querySelector('[data-start-email]'),
  subscriptionList: document.querySelector('[data-subscription-list]'),
  subscriptionSummary: document.querySelector('[data-subscription-summary]'),
  subscribeForm: document.querySelector('[data-subscribe-form]'),
  triggers: document.querySelectorAll('[data-panel-trigger]')
}

function readSavedEmail () {
  return localStorage.getItem(storageKeys.email) ?? ''
}

function writeSavedEmail (email) {
  const trimmedEmail = email.trim()

  if (trimmedEmail === '') {
    localStorage.removeItem(storageKeys.email)
  } else {
    localStorage.setItem(storageKeys.email, trimmedEmail)
  }

  syncEmailFields()
}

function readPreferences () {
  try {
    const raw = localStorage.getItem(storageKeys.preferences)
    const parsed = raw === null ? {} : JSON.parse(raw)

    return {
      ...defaultPreferences,
      ...parsed
    }
  } catch {
    return { ...defaultPreferences }
  }
}

function writePreferences (preferences) {
  localStorage.setItem(storageKeys.preferences, JSON.stringify(preferences))
  applyPreferences(preferences)
}

function applyPreferences (preferences) {
  document.body.dataset.backgroundDim = preferences.backgroundDim
  document.body.dataset.clockFormat = preferences.clockFormat
  document.body.dataset.density = preferences.density
  document.body.dataset.motion = preferences.motion

  elements.preferenceControls.forEach((control) => {
    const key = control.dataset.preference
    if (key !== undefined && key in preferences) {
      control.value = preferences[key]
    }
  })
}

function isEmailLike (email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function syncEmailFields () {
  const email = readSavedEmail()
  const label = email === '' ? 'No email saved' : email

  if (elements.startEmail !== null) {
    elements.startEmail.textContent = label
  }

  if (elements.accountSummary !== null) {
    elements.accountSummary.textContent = email === ''
      ? 'No saved email yet.'
      : `Saved email: ${email}`
  }

  if (elements.subscriptionSummary !== null) {
    elements.subscriptionSummary.textContent = email === ''
      ? 'Save an email, then load subscriptions.'
      : `Ready to load subscriptions for ${email}.`
  }

  if (elements.menuEmail !== null) {
    elements.menuEmail.value = email
  }

  if (elements.accountEmail !== null) {
    elements.accountEmail.value = email
  }
}

function setMenuOpen (isOpen) {
  if (elements.menu === null || elements.startButton === null) {
    return
  }

  elements.menu.hidden = !isOpen
  elements.startButton.setAttribute('aria-expanded', String(isOpen))
}

function showPanel (panelName) {
  elements.panels.forEach((panel) => {
    panel.hidden = panel.dataset.panel !== panelName
  })

  elements.triggers.forEach((trigger) => {
    trigger.setAttribute(
      'aria-current',
      trigger.dataset.panelTrigger === panelName ? 'true' : 'false'
    )
  })
}

function clearSubscriptionList () {
  if (elements.subscriptionList !== null) {
    elements.subscriptionList.replaceChildren()
  }
}

function setSubscriptionMessage (message) {
  clearSubscriptionList()

  if (elements.subscriptionList === null) {
    return
  }

  const paragraph = document.createElement('p')
  paragraph.textContent = message
  elements.subscriptionList.append(paragraph)
}

function renderSubscriptions (subscriptions) {
  clearSubscriptionList()

  if (elements.subscriptionList === null) {
    return
  }

  if (subscriptions.length === 0) {
    setSubscriptionMessage('No active subscriptions for this email yet.')
    return
  }

  const fragment = document.createDocumentFragment()

  subscriptions.forEach((subscription) => {
    const item = document.createElement('article')
    item.className = 'subscription-item'

    const repo = document.createElement('strong')
    repo.textContent = subscription.repo

    const meta = document.createElement('p')
    meta.className = 'subscription-meta'
    meta.textContent = `${subscription.confirmed ? 'Confirmed' : 'Pending'} · Last seen: ${subscription.last_seen_tag ?? 'none yet'}`

    const link = document.createElement('a')
    link.href = `https://github.com/${subscription.repo}`
    link.rel = 'noreferrer'
    link.target = '_blank'
    link.textContent = 'Open on GitHub'

    item.append(repo, meta, link)
    fragment.append(item)
  })

  elements.subscriptionList.append(fragment)
}

async function loadSubscriptions () {
  const email = readSavedEmail()

  if (!isEmailLike(email)) {
    setSubscriptionMessage('Save a valid email before loading subscriptions.')
    return
  }

  setSubscriptionMessage('Loading subscriptions...')

  try {
    const response = await fetch(`/subscriptions?email=${encodeURIComponent(email)}`)

    if (!response.ok) {
      setSubscriptionMessage('Subscriptions could not be loaded right now.')
      return
    }

    const subscriptions = await response.json()
    renderSubscriptions(Array.isArray(subscriptions) ? subscriptions : [])
  } catch {
    setSubscriptionMessage('Network trouble. Try loading subscriptions again.')
  }
}

function updateClock () {
  if (elements.clock === null) {
    return
  }

  const preferences = readPreferences()
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    hour12: preferences.clockFormat === '12',
    minute: '2-digit'
  })

  elements.clock.textContent = formatter.format(new Date())
}

function bindEvents () {
  elements.startButton?.addEventListener('click', () => {
    setMenuOpen(elements.menu?.hidden === true)
  })

  document.addEventListener('click', (event) => {
    if (
      elements.menu === null ||
      elements.startButton === null ||
      elements.menu.hidden ||
      !(event.target instanceof Node)
    ) {
      return
    }

    if (!elements.menu.contains(event.target) && !elements.startButton.contains(event.target)) {
      setMenuOpen(false)
    }
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setMenuOpen(false)
    }
  })

  elements.triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const panelName = trigger.dataset.panelTrigger

      if (panelName !== undefined) {
        showPanel(panelName)
      }
    })
  })

  elements.subscribeForm?.addEventListener('submit', () => {
    const formData = new FormData(elements.subscribeForm)
    const email = formData.get('email')

    if (typeof email === 'string' && email.trim() !== '') {
      writeSavedEmail(email)
    }
  })

  elements.saveEmail?.addEventListener('click', () => {
    writeSavedEmail(elements.menuEmail?.value ?? '')
  })

  elements.saveAccount?.addEventListener('click', () => {
    writeSavedEmail(elements.accountEmail?.value ?? '')
  })

  elements.clearEmail?.addEventListener('click', () => {
    writeSavedEmail('')
    setSubscriptionMessage('Save an email, then load subscriptions.')
  })

  elements.clearLocalData?.addEventListener('click', () => {
    localStorage.removeItem(storageKeys.email)
    localStorage.removeItem(storageKeys.preferences)
    applyPreferences({ ...defaultPreferences })
    syncEmailFields()
    setSubscriptionMessage('Local taskbar data cleared.')
  })

  elements.loadSubscriptions?.addEventListener('click', () => {
    void loadSubscriptions()
  })

  elements.preferenceControls.forEach((control) => {
    control.addEventListener('change', () => {
      const preferences = readPreferences()
      const key = control.dataset.preference

      if (key !== undefined) {
        preferences[key] = control.value
        writePreferences(preferences)
        updateClock()
      }
    })
  })
}

applyPreferences(readPreferences())
syncEmailFields()
showPanel('subscriptions')
bindEvents()
updateClock()
setInterval(updateClock, 30000)
```

If lint complains about dynamic preference indexing, use an allowlisted setter:

```js
if (key === 'clockFormat' || key === 'backgroundDim' || key === 'motion' || key === 'density') {
  preferences[key] = control.value
}
```

- [ ] **Step 4: Run web tests**

Run:

```bash
pnpm test -- src/features/web/routes.test.ts
```

Expected:

- Script static asset test passes.
- Route tests still pass.

- [ ] **Step 5: Commit browser script**

```bash
git add static/scripts/app.js src/features/web/routes.test.ts
git commit -m "feat: add xp start menu script"
```

---

## Task 7: Final Verification And Manual Smoke

**Files:**
- No required code edits unless verification finds issues.

- [ ] **Step 1: Run focused web/API tests**

Run:

```bash
pnpm test -- src/features/web/routes.test.ts src/features/subscriptions/routes.test.ts src/app.test.ts
```

Expected:

- All focused route tests pass.

- [ ] **Step 2: Run full verification**

Run:

```bash
pnpm typecheck
pnpm test
pnpm lint
```

Expected:

- Typecheck passes.
- Tests pass.
- Lint should pass. If it fails with the known `neostandard`/`find-up` ESM issue, report the exact failure and do not claim lint is clean.

- [ ] **Step 3: Start local app for browser smoke**

If dependencies and local services are available, run:

```bash
pnpm dev
```

Open:

```text
http://localhost:3000/
```

Manual checks:

- Background image is visible and dimmed enough for readability.
- Home page still submits through a normal POST.
- Taskbar appears at the bottom on desktop and mobile widths.
- Start button opens and closes the menu.
- Escape and outside click close the menu.
- Clock updates.
- Account saves and clears email.
- Preferences persist across refresh.
- My Subscriptions loads subscriptions only when the explicit button is pressed.
- Token result pages still render for `/confirm/:token` and `/unsubscribe/:token`.

- [ ] **Step 4: Review git diff**

Run:

```bash
git status --short
git diff --stat
```

Expected:

- Only intended UI files and dependency files changed.
- User-owned staged `src/features/github/client.ts` remains handled according to the user's current instruction.

- [ ] **Step 5: Final commit if needed**

If any verification fixes were needed:

```bash
git add <fixed-files>
git commit -m "fix: polish xp web ui"
```

Otherwise do not create an empty commit.

---

## Execution Notes

- Use TDD for each behavioral slice: write or update tests first, watch them fail, then implement.
- Keep the protected `/api` routes unchanged.
- Keep `POST /subscribe` as a server-rendered form POST.
- Use `reply.viewAsync` rather than building HTML strings in route handlers.
- Use `textContent`, `createElement`, and `append` for fetched/localStorage data in browser JS.
- Do not add frontend dependencies beyond EJS/static/view plugins in this iteration.
- Do not fix the lint hook dependency issue unless the user explicitly approves that scope.
