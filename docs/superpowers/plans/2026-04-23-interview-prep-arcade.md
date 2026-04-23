# Interview Prep Arcade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public `/quiz` route that serves a mobile-friendly, gamified interview-prep arcade based on the course page, assignment, and the existing codebase, then deploy it to the existing Railway app.

**Architecture:** Keep the existing Fastify monolith and add the quiz as a public web route under the existing `webRoutes` plugin. Use a dedicated quiz EJS layout plus static browser modules: one content module for questions/diagrams/badges, one pure engine module for scoring and retry logic, and one DOM runtime module for rendering the quiz. Keep all learning content client-side after page load so the route stays read-only and does not touch protected `/api/*`.

**Tech Stack:** Node 24 native TypeScript, Fastify 5, EJS, `@fastify/static`, vanilla browser JavaScript modules, Vitest route and module tests, Railway CLI for deployment.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-04-23-interview-prep-arcade-design.md`
- Existing web plan: `docs/superpowers/plans/2026-04-12-ejs-static-xp-start-menu.md`
- Fixed API contract: `swagger.yaml`
- Assignment notes: `task.md`
- Repo instructions: `AGENTS.md`

## Required Skills

- @node for browser module structure, static assets, runtime behavior, and deployment commands.
- @fastify-best-practices for route registration, view rendering, and `inject()` tests.
- @typescript-magician for every TypeScript file changed during tests and route work.
- @use-railway before any Railway discovery, deploys, logs, or deployed smoke checks.
- @test-driven-development before each production behavior change.
- @verification-before-completion before claiming the feature is complete or deployed successfully.
- @linting-neostandard-eslint9 only if lint or hook issues require config changes. Do not expand scope otherwise.

## Scope Check

This plan is still one focused feature, not multiple independent subsystems:

- one public web route
- one client-side quiz experience
- one deployment verification pass

Do not split it further unless browser runtime complexity grows enough to require a separate follow-up for additional polish.

## Current Git Caveats

At plan creation time:

- the worktree is clean
- the approved design spec is already committed at `10da230`

## File Structure

- Modify `src/features/web/routes.ts`: add `GET /quiz`, add a quiz render helper, and keep existing public routes unchanged.
- Modify `src/features/web/routes.test.ts`: cover the new route, quiz asset references, and static quiz asset serving.
- Create `src/features/web/views/quiz-layout.ejs`: dedicated HTML shell for the quiz page, with viewport meta tag, quiz stylesheet, quiz script, and a `noscript` fallback.
- Create `src/features/web/views/quiz.ejs`: quiz page content wrapper with hero copy, mount node, and fallback loading content.
- Create `static/scripts/quiz-content.js`: structured question dataset, diagram metadata, and achievement labels.
- Create `static/scripts/quiz-engine.js`: pure scoring/progress/retry helpers shared by tests and the browser runtime.
- Create `static/scripts/quiz.js`: DOM rendering, event binding, persistence, HUD updates, retry flow, diagrams, weak spots, and cram view.
- Create `static/styles/quiz.css`: mobile-first arcade styling, HUD, question cards, diagrams, feedback states, and reduced-motion behavior.
- Create `src/features/web/quiz-content.test.ts`: dataset invariants, question counts, category coverage, and diagram references.
- Create `src/features/web/quiz-engine.test.ts`: answer evaluation, first-attempt scoring, retry behavior, weak-spot tracking, and cram-summary helpers.
- Modify `README.md`: mention `/quiz` in local and deployed smoke-test instructions.

Keep the existing XP home page isolated. Do not thread quiz-specific CSS or JS through `layout.ejs` or `static/scripts/app.js` unless a smaller targeted change becomes impossible.

---

## Task 1: Add `/quiz` Route And Asset Test Coverage

**Files:**
- Modify: `src/features/web/routes.test.ts`
- Modify: `src/features/web/routes.ts`
- Create: `src/features/web/views/quiz-layout.ejs`
- Create: `src/features/web/views/quiz.ejs`
- Create: `static/styles/quiz.css`
- Create: `static/scripts/quiz.js`

- [ ] **Step 1: Write the failing route test for `/quiz`**

Add to `src/features/web/routes.test.ts`:

```ts
it('renders the interview prep quiz page without an API key', async () => {
  const app = buildApp({}, {
    web: {
      service: createServiceStub()
    }
  })
  await app.ready()

  const response = await app.inject({
    method: 'GET',
    url: '/quiz'
  })

  expect(response.statusCode).toBe(200)
  expect(response.headers['content-type']).toContain('text/html')
  expect(response.body).toContain('Interview Prep Arcade')
  expect(response.body).toContain('data-quiz-root')
  expect(response.body).toContain('href="/assets/styles/quiz.css"')
  expect(response.body).toContain('src="/assets/scripts/quiz.js"')
  await app.close()
})
```

- [ ] **Step 2: Write the failing quiz asset tests**

Add to `src/features/web/routes.test.ts`:

```ts
it('serves the quiz stylesheet', async () => {
  const app = buildApp({}, {
    web: {
      service: createServiceStub()
    }
  })
  await app.ready()

  const response = await app.inject({
    method: 'GET',
    url: '/assets/styles/quiz.css'
  })

  expect(response.statusCode).toBe(200)
  expect(response.headers['content-type']).toContain('text/css')
  await app.close()
})

it('serves the quiz runtime script', async () => {
  const app = buildApp({}, {
    web: {
      service: createServiceStub()
    }
  })
  await app.ready()

  const response = await app.inject({
    method: 'GET',
    url: '/assets/scripts/quiz.js'
  })

  expect(response.statusCode).toBe(200)
  expect(response.headers['content-type']).toContain('javascript')
  await app.close()
})
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
pnpm test -- src/features/web/routes.test.ts
```

Expected:

- the new `/quiz` test fails with `404`
- quiz asset tests fail with `404`

- [ ] **Step 4: Add the minimal `/quiz` route and placeholder assets**

In `src/features/web/routes.ts`, add a helper:

```ts
async function renderQuiz (reply: FastifyReply) {
  const body = await reply.viewAsync('quiz.ejs', {
    title: 'Interview Prep Arcade'
  })

  return await reply
    .type('text/html')
    .viewAsync('quiz-layout.ejs', {
      body,
      title: 'Interview Prep Arcade'
    })
}
```

Then register:

```ts
fastify.get('/quiz', async (_request, reply) => {
  return await renderQuiz(reply)
})
```

Create `src/features/web/views/quiz-layout.ejs`:

```ejs
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><%= title %></title>
  <link rel="stylesheet" href="/assets/styles/quiz.css">
  <script type="module" src="/assets/scripts/quiz.js"></script>
</head>
<body class="quiz-page">
  <%- body %>
</body>
</html>
```

Create `src/features/web/views/quiz.ejs`:

```ejs
<main class="quiz-shell">
  <section class="quiz-hero">
    <h1>Interview Prep Arcade</h1>
    <p>Backend panic, but make it playable.</p>
  </section>
  <section data-quiz-root>
    <noscript>This page needs JavaScript to run the quiz.</noscript>
  </section>
</main>
```

Create placeholder assets:

`static/styles/quiz.css`

```css
body.quiz-page {
  margin: 0;
}
```

`static/scripts/quiz.js`

```js
console.log('Interview Prep Arcade booting')
```

- [ ] **Step 5: Run tests to verify pass**

Run:

```bash
pnpm test -- src/features/web/routes.test.ts
```

Expected:

- `/quiz` test passes
- quiz asset tests pass
- existing `/`, `/subscribe`, `/confirm/:token`, and `/unsubscribe/:token` tests still pass

- [ ] **Step 6: Commit the route shell**

```bash
git add src/features/web/routes.ts src/features/web/routes.test.ts src/features/web/views/quiz-layout.ejs src/features/web/views/quiz.ejs static/styles/quiz.css static/scripts/quiz.js
git commit -m "feat: add quiz route shell"
```

---

## Task 2: Create The Quiz Content Module And Invariants

**Files:**
- Create: `static/scripts/quiz-content.js`
- Create: `src/features/web/quiz-content.test.ts`

- [ ] **Step 1: Write failing dataset invariants**

Create `src/features/web/quiz-content.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  quizAchievements,
  quizDiagrams,
  quizQuestions
} from '../../../static/scripts/quiz-content.js'

describe('quiz content', () => {
  it('covers the planned interview-prep scope', () => {
    expect(quizQuestions).toHaveLength(30)
    expect(quizDiagrams).toHaveLength(4)
    expect(quizAchievements.length).toBeGreaterThanOrEqual(3)
  })

  it('uses unique question ids and required question kinds', () => {
    expect(new Set(quizQuestions.map((question) => question.id)).size).toBe(quizQuestions.length)
    expect(new Set(quizQuestions.map((question) => question.kind))).toEqual(
      new Set(['single', 'multi', 'order', 'boss'])
    )
  })

  it('matches the category distribution from the spec', () => {
    const counts = Object.fromEntries(
      quizQuestions.reduce((map, question) => {
        map.set(question.category, (map.get(question.category) ?? 0) + 1)
        return map
      }, new Map())
    )

    expect(counts).toEqual({
      api: 6,
      architecture: 2,
      database: 6,
      deployment: 4,
      scanner: 5,
      security: 4,
      testing: 3
    })
  })
})
```

- [ ] **Step 2: Run the new test and verify failure**

Run:

```bash
pnpm test -- src/features/web/quiz-content.test.ts
```

Expected:

- Vitest fails because `static/scripts/quiz-content.js` does not exist yet

- [ ] **Step 3: Create the structured content module**

Create `static/scripts/quiz-content.js` with this shape:

```js
export const quizAchievements = [
  { id: 'rate-limit-survivor', label: 'Rate Limit Survivor' },
  { id: 'token-tamer', label: 'Token Tamer' },
  { id: 'monolith-defender', label: 'Monolith Defender' }
]

export const quizDiagrams = [
  { id: 'request-surface', title: 'Request Surface', kind: 'request-surface' },
  { id: 'subscription-lifecycle', title: 'Subscription Lifecycle', kind: 'subscription-lifecycle' },
  { id: 'release-scanner', title: 'Release Scanner', kind: 'release-scanner' },
  { id: 'cache-fallback', title: 'Cache Fallback', kind: 'cache-fallback' }
]

export const quizQuestions = [
  {
    id: 'api-protected-routes',
    category: 'api',
    kind: 'single',
    prompt: 'Why are `/api/*` routes protected with `x-api-key` while `/quiz` stays public?',
    options: [
      { id: 'a', label: 'Because browsers cannot send headers' },
      { id: 'b', label: 'Because the quiz is read-only public content, while `/api/*` is programmatic app surface' },
      { id: 'c', label: 'Because Fastify only supports auth under `/api`' }
    ],
    correctOptionIds: ['b'],
    explanation: 'The quiz page is public learning content, but the real API surface needs protection because it exposes application behavior and data lookups.',
    interviewAnswer: 'I kept `/quiz` public because it is just static interview prep content. `/api/*` stays protected because those routes are part of the actual application surface and should require an API key.',
    deeperFollowUp: 'If I ever made the quiz dynamic or user-specific, I would reassess auth separately instead of piggybacking on the API key.'
  }
]
```

Fill the module to the full planned scope:

- exactly `30` questions
- category counts `6/2/6/4/5/4/3`
- kinds include `single`, `multi`, `order`, and `boss`
- at least four questions reference the four diagrams by `diagramId`
- every question includes `explanation`, `interviewAnswer`, and `deeperFollowUp`

Question content must stay grounded in:

- Fastify route/plugin structure
- public versus protected routes
- token validation and lifecycle
- PostgreSQL schema and `last_seen_tag`
- Redis fallback
- GitHub rate limits
- Docker Compose and Railway deployment
- metrics and API key auth
- testing strategy
- monolith/system-design trade-offs

- [ ] **Step 4: Re-run the content test and verify pass**

Run:

```bash
pnpm test -- src/features/web/quiz-content.test.ts
```

Expected:

- dataset invariants pass

- [ ] **Step 5: Commit the question bank**

```bash
git add static/scripts/quiz-content.js src/features/web/quiz-content.test.ts
git commit -m "feat: add quiz question bank"
```

---

## Task 3: Build And Test The Quiz Scoring Engine

**Files:**
- Create: `static/scripts/quiz-engine.js`
- Create: `src/features/web/quiz-engine.test.ts`

- [ ] **Step 1: Write failing engine tests**

Create `src/features/web/quiz-engine.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  applyAttempt,
  createInitialProgress,
  evaluateQuestion,
  summarizeWeakTopics
} from '../../../static/scripts/quiz-engine.js'

const singleQuestion = {
  id: 'api-protected-routes',
  category: 'api',
  correctOptionIds: ['b'],
  kind: 'single'
}

describe('quiz engine', () => {
  it('evaluates single-choice questions', () => {
    expect(evaluateQuestion(singleQuestion, ['b']).isCorrect).toBe(true)
    expect(evaluateQuestion(singleQuestion, ['a']).isCorrect).toBe(false)
  })

  it('records a miss on the first wrong attempt and keeps it after retry success', () => {
    const progress = createInitialProgress([singleQuestion])
    const afterMiss = applyAttempt(progress, singleQuestion, ['a'])
    const afterRetry = applyAttempt(afterMiss.progress, singleQuestion, ['b'])

    expect(afterMiss.result.shouldRetry).toBe(true)
    expect(afterRetry.progress.missedQuestionIds).toEqual(['api-protected-routes'])
    expect(afterRetry.progress.correctQuestionIds).toEqual(['api-protected-routes'])
    expect(afterRetry.progress.streak).toBe(0)
  })

  it('summarizes weak topics from missed questions', () => {
    const summary = summarizeWeakTopics([
      {
        category: 'scanner',
        id: 'scanner-baseline',
        interviewAnswer: 'First scan stores the baseline tag and sends no email.'
      }
    ], ['scanner-baseline'])

    expect(summary[0]).toMatchObject({
      category: 'scanner',
      misses: 1
    })
  })
})
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
pnpm test -- src/features/web/quiz-engine.test.ts
```

Expected:

- Vitest fails because `static/scripts/quiz-engine.js` does not exist yet

- [ ] **Step 3: Create the pure engine module**

Create `static/scripts/quiz-engine.js`:

```js
export function evaluateQuestion (question, selectedOptionIds) {
  const selected = [...selectedOptionIds].sort()
  const expected = [...question.correctOptionIds].sort()

  return {
    correctOptionIds: expected,
    isCorrect: JSON.stringify(selected) === JSON.stringify(expected)
  }
}

export function createInitialProgress (questions) {
  return {
    answeredQuestionIds: [],
    correctQuestionIds: [],
    currentIndex: 0,
    missedQuestionIds: [],
    score: 0,
    streak: 0,
    firstAttemptOutcomes: Object.fromEntries(
      questions.map((question) => [question.id, null])
    )
  }
}
```

Then add:

- `applyAttempt(progress, question, selectedOptionIds)`
- `getRetryQueue(questions, missedQuestionIds)`
- `summarizeWeakTopics(questions, missedQuestionIds)`

Rules to implement:

- `single` and `boss` questions compare one selected option against `correctOptionIds`
- `multi` questions compare sets, ignoring selection order
- `order` questions compare the exact selected sequence against `correctOptionIds`
- wrong first attempts break the streak
- wrong first attempts add the question id to `missedQuestionIds`
- retry success adds the question to `correctQuestionIds` but does not erase the miss
- XP/score should only increment once per question, on the first successful solve

- [ ] **Step 4: Re-run the engine tests and verify pass**

Run:

```bash
pnpm test -- src/features/web/quiz-engine.test.ts
```

Expected:

- single-choice evaluation passes
- wrong-answer retry invariants pass
- weak-topic summary test passes

- [ ] **Step 5: Commit the scoring engine**

```bash
git add static/scripts/quiz-engine.js src/features/web/quiz-engine.test.ts
git commit -m "feat: add quiz scoring engine"
```

---

## Task 4: Render The Quiz Runtime And Retry Loop

**Files:**
- Modify: `src/features/web/views/quiz.ejs`
- Modify: `static/scripts/quiz.js`
- Modify: `static/styles/quiz.css`

- [ ] **Step 1: Expand the quiz page markup for the runtime**

Update `src/features/web/views/quiz.ejs` to provide a stable shell:

```ejs
<main class="quiz-shell">
  <header class="quiz-hero">
    <p class="quiz-kicker">Tomorrow's interview boss fight</p>
    <h1>Interview Prep Arcade</h1>
    <p class="quiz-subtitle">Likely technical questions from your task, your codebase, and the course page.</p>
  </header>

  <section class="quiz-status" data-quiz-hud></section>
  <section class="quiz-app" data-quiz-root>
    <noscript>This page needs JavaScript to run the quiz.</noscript>
  </section>
</main>
```

- [ ] **Step 2: Replace the placeholder runtime with module imports**

Rewrite `static/scripts/quiz.js` around:

```js
import { quizAchievements, quizDiagrams, quizQuestions } from './quiz-content.js'
import {
  applyAttempt,
  createInitialProgress,
  getRetryQueue,
  summarizeWeakTopics
} from './quiz-engine.js'
```

Store local progress under dedicated keys:

```js
const storageKeys = {
  progress: 'interviewPrepArcade.progress',
  reducedMotion: 'interviewPrepArcade.reducedMotion'
}
```

- [ ] **Step 3: Implement intro, HUD, and question rendering**

Add render helpers in `static/scripts/quiz.js`:

- `renderIntro()`
- `renderHud(progress, currentQuestion)`
- `renderQuestion(question, progress)`
- `renderFeedback(result, question)`

Question-card UI requirements:

- support `single`, `multi`, `order`, and `boss`
- show prompt, category, and progress
- keep controls large enough for mobile taps
- do not auto-advance on answer selection

- [ ] **Step 4: Implement wrong-answer reveal and retry**

Use the engine result to show:

- the correct answer label or labels
- the short explanation
- the interview-ready answer
- a `Retry This One` button
- a separate `Continue Anyway` button only after the retry succeeds

Behavior:

- first wrong attempt records the miss and breaks the streak
- retry stays on the same question
- after retry success, the user can continue forward

- [ ] **Step 5: Manually smoke test the route in the browser**

Run:

```bash
pnpm dev
```

Open `http://localhost:3000/quiz` and verify:

- intro screen renders
- HUD updates after `Start`
- answering wrong reveals the correct answer and retry action
- retry success allows progress
- refreshing the page restores progress from `localStorage`

- [ ] **Step 6: Re-run automated tests**

Run:

```bash
pnpm test -- src/features/web/routes.test.ts src/features/web/quiz-content.test.ts src/features/web/quiz-engine.test.ts
```

Expected:

- route tests still pass
- content and engine tests still pass

- [ ] **Step 7: Commit the runtime skeleton**

```bash
git add src/features/web/views/quiz.ejs static/scripts/quiz.js static/styles/quiz.css
git commit -m "feat: add quiz runtime and retry flow"
```

---

## Task 5: Add Diagrams, Boss Fights, Weak Spots, And Cram Mode

**Files:**
- Modify: `static/scripts/quiz-content.js`
- Modify: `static/scripts/quiz-engine.js`
- Modify: `static/scripts/quiz.js`
- Modify: `static/styles/quiz.css`
- Modify: `src/features/web/quiz-content.test.ts`

- [ ] **Step 1: Extend the content test for diagram and reference integrity**

Add to `src/features/web/quiz-content.test.ts`:

```ts
it('only references declared diagrams and achievements', () => {
  const diagramIds = new Set(quizDiagrams.map((diagram) => diagram.id))
  const achievementIds = new Set(quizAchievements.map((achievement) => achievement.id))

  quizQuestions.forEach((question) => {
    if (question.diagramId !== undefined) {
      expect(diagramIds.has(question.diagramId)).toBe(true)
    }

    if (question.achievementId !== undefined) {
      expect(achievementIds.has(question.achievementId)).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run tests and verify failure if references are missing**

Run:

```bash
pnpm test -- src/features/web/quiz-content.test.ts
```

Expected:

- test fails until all `diagramId` and `achievementId` references are consistent

- [ ] **Step 3: Render the four diagram pit stops**

In `static/scripts/quiz.js`, add:

- `renderDiagramPitStop(diagram)`
- inline SVG builders for:
  - request surface
  - subscription lifecycle
  - release scanner
  - cache fallback

Each pit stop must show:

- diagram title
- one-line caption
- `Why this matters in an interview`

- [ ] **Step 4: Add boss fights, weak spots, and cram mode**

Implement:

- boss fights inserted after regular clusters
- weak-spots panel driven by `missedQuestionIds`
- `Retry Weak Spots` mode using `getRetryQueue`
- final cram summary from `summarizeWeakTopics`

The final results screen must include:

- XP total
- final streak
- weakest 3-5 topics
- short spoken answers for those weak topics

- [ ] **Step 5: Add achievement toasts and lightweight meme flavor**

Use `quizAchievements` to show short non-blocking toasts such as:

- `Rate Limit Survivor`
- `Token Tamer`
- `Monolith Defender`

Keep this lightweight:

- short copy only
- no sound
- no flashing

- [ ] **Step 6: Re-run tests and smoke test in the browser**

Run:

```bash
pnpm test -- src/features/web/quiz-content.test.ts src/features/web/quiz-engine.test.ts
```

Then manually verify at `http://localhost:3000/quiz`:

- at least four pit stops appear
- boss fights render distinctly
- missed questions appear in weak spots
- final cram section shows short usable answers

- [ ] **Step 7: Commit the full learning loop**

```bash
git add static/scripts/quiz-content.js static/scripts/quiz-engine.js static/scripts/quiz.js static/styles/quiz.css src/features/web/quiz-content.test.ts
git commit -m "feat: add quiz diagrams and cram mode"
```

---

## Task 6: Mobile, Accessibility, And Polish Pass

**Files:**
- Modify: `static/styles/quiz.css`
- Modify: `src/features/web/views/quiz-layout.ejs`
- Modify: `static/scripts/quiz.js`

- [ ] **Step 1: Add mobile-first and reduced-motion rules**

In `static/styles/quiz.css`, add:

- one-column layout by default
- sticky compact HUD
- touch-friendly button sizing
- `@media (min-width: 768px)` desktop expansion
- `@media (prefers-reduced-motion: reduce)` to shorten or remove motion

Minimum CSS targets:

- readable at `360px`
- no horizontal scrolling
- diagrams fit the viewport without zoom

- [ ] **Step 2: Add accessibility hooks**

In `static/scripts/quiz.js` and `quiz-layout.ejs`, ensure:

- focus moves predictably after submit/retry/continue
- buttons and groups have labels
- result messages use `role="status"` or `aria-live="polite"`
- the retry button is keyboard reachable

- [ ] **Step 3: Manual mobile smoke test**

Run:

```bash
pnpm dev
```

Use the browser device toolbar or a real phone and verify:

- `/quiz` is readable without zoom
- buttons are tap-friendly
- wrong-answer explanation does not flood the screen
- diagrams stay legible
- end-of-run cram sheet is usable in bed on a phone

- [ ] **Step 4: Commit the polish pass**

```bash
git add static/styles/quiz.css src/features/web/views/quiz-layout.ejs static/scripts/quiz.js
git commit -m "style: polish quiz mobile experience"
```

---

## Task 7: Document The New Route And Local Smoke Checks

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add `/quiz` to the public-surface documentation**

Update `README.md` in these sections:

- architecture or runtime surface summary
- local run/smoke-test section
- deployed app notes

Add examples like:

```text
GET /quiz
```

and

```bash
curl -i 'http://localhost:3000/quiz'
curl -i 'https://<railway-domain>/quiz'
```

- [ ] **Step 2: Run a quick docs sanity check**

Run:

```bash
rg -n "/quiz|Interview Prep Arcade" README.md src/features/web/routes.ts src/features/web/views/quiz.ejs
```

Expected:

- README and route/view references line up

- [ ] **Step 3: Commit the docs update**

```bash
git add README.md
git commit -m "docs: add quiz route notes"
```

---

## Task 8: Full Verification And Railway Deploy

**Files:**
- Modify: none expected if verification passes

- [ ] **Step 1: Run full local verification**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Expected:

- all commands exit `0`

- [ ] **Step 2: Preflight Railway context**

Use @use-railway.

Run:

```bash
command -v railway
railway --version
railway status --json
railway deployment list --service <app-service> --limit 5 --json
```

Expected:

- Railway CLI is installed
- the correct project/environment/service are identifiable

- [ ] **Step 3: Deploy the current app build**

Use @use-railway.

Run:

```bash
railway up --service <app-service> --detach -m "Deploy interview prep quiz arcade"
```

Expected:

- Railway starts a new deployment for the existing app service

- [ ] **Step 4: Read back deployment status and logs**

Use @use-railway.

Run:

```bash
railway deployment list --service <app-service> --limit 5 --json
railway logs --service <app-service> --lines 200 --json
```

Expected:

- latest deployment is healthy
- logs show app startup without route/view/static asset errors

- [ ] **Step 5: Smoke test the deployed route**

Run:

```bash
curl -i 'https://<railway-domain>/quiz'
curl -i 'https://<railway-domain>/'
curl -i 'https://<railway-domain>/api/subscriptions?email=alice@example.com'
```

Expected:

- `/quiz` returns `200` and contains `Interview Prep Arcade`
- `/` still returns `200`
- protected `/api/subscriptions` still returns `401` without `x-api-key`

- [ ] **Step 6: Smoke test the learning loop in a browser**

Open:

```text
https://<railway-domain>/quiz
```

Verify:

- the page loads on mobile
- wrong answers reveal the correct answer plus short explanation
- retry works
- weak spots and cram mode render

- [ ] **Step 7: Record final state**

Capture for the handoff:

- deployed URL
- commit SHA
- local verification commands run
- any known follow-up polish items

No commit is required here unless deployment verification exposed a bug that needed a fix.
