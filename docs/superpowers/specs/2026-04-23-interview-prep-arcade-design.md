# Interview Prep Arcade Design

## Status

Approved during brainstorming on 2026-04-23.

## Context

The user has already completed the practical task for Genesis Software Engineering School and wants a fast, engaging way to prepare for a short interview on 2026-04-24. They are primarily a frontend engineer, feel less confident about backend topics, and do not want to study from long text while tired.

This design turns the user's existing project into a focused interview-prep artifact. The content must be derived from three inputs:

- the public Software Engineering School page, especially the modules on architecture, databases, observability, security, CI/CD, and system design
- the assignment description for the GitHub release notification API
- the actual codebase, including Fastify plugins, public vs protected routes, PostgreSQL schema, release scanning, Redis caching, metrics, Docker Compose, Railway deployment, and tests

The user explicitly wants:

- an interactive quiz-prep experience that can be opened easily on desktop and phone
- strong emphasis on likely technical questions
- quiz-based interaction instead of passive reading
- gamified presentation with diagrams and meme energy
- mobile-friendly behavior so it works on a phone before sleep
- deployment through the existing app at `/quiz`

## Goals

- Produce a public `/quiz` experience inside the existing Fastify app.
- Make the experience interactive enough to keep a tired user engaged through active recall.
- Focus primarily on likely technical questions the interviewer may ask, based on the course description, assignment, and implemented code.
- Keep explanations short, interview-oriented, and easy to memorize.
- Include lightweight diagrams that explain the system and common interview topics visually.
- Add playful presentation, achievements, and joke flavor without obscuring the learning goals.
- Work well on both desktop and narrow mobile screens.
- Preserve progress and weak-topic tracking locally in the browser when possible.

## Non-Goals

- No new protected API surface or Swagger contract changes.
- No external APIs, runtime fetches, or backend dependencies.
- No frontend build tooling, bundler, framework, or package installation.
- No large essay-style theory reference covering every backend topic in depth.
- No external image hosting dependencies that could fail offline or under `file://`.
- No attempt to predict every possible interview question; the goal is likely high-signal questions, not exhaustive coverage.

## Recommended Approach

Add a public `GET /quiz` route to the existing app and render the experience with the same server-rendered web stack already used in the repository.

Suggested shape:

- one new EJS view for the quiz page
- one dedicated static stylesheet
- one dedicated static JavaScript file
- inline or bundled same-origin SVG diagrams
- a structured in-browser question dataset shipped with the page

This approach is the best fit because it is:

- available from the deployed app on the phone
- mobile-safe
- consistent with the existing app patterns
- easy to share or reopen later
- deployable without creating a second app

## Content Source And Question Strategy

The quiz content should come from three layers.

### Layer 1: Codebase-grounded questions

These are the most important because they help the user explain their own project confidently.

Primary topics:

- why the project is a monolith
- why Fastify routes are split into public web routes and protected `/api` routes
- how the API key guard works
- what the confirmation and unsubscribe tokens do
- why UUID validation exists before DB lookup
- how the subscription lifecycle works
- why subscriptions and repositories are stored separately
- what `last_seen_tag` is for
- why the first scan establishes a baseline instead of sending emails immediately
- how Redis caching works and why the app can continue without Redis
- how GitHub rate limits are handled
- why metrics are protected
- what Docker Compose services do
- what Railway variables and production wiring are required
- how and why tests are split by business logic, plugins, and route behavior

### Layer 2: Assignment-grounded questions

These map to the original practical task and likely follow-ups.

Primary topics:

- why Fastify was chosen for this service shape
- why PostgreSQL is the source of truth
- why the task keeps API, scanner, and notifier in one service
- how repository validation works
- what statuses should be returned for invalid input, missing repo, duplicate subscription, invalid token, or upstream limits
- how database migrations run on startup
- why Docker support matters for evaluation
- how release polling differs from webhook-based designs

### Layer 3: Course-aligned conceptual questions

These broaden the prep toward topics highlighted on the course page.

Primary topics:

- monolith vs microservices
- layered architecture
- caching basics and trade-offs
- observability: metrics, logs, traces
- CI/CD basics
- security-first design
- database indexes and constraints
- API design and idempotency
- reliability and graceful degradation

## Final Scope

Target approximately `30` questions, grouped into these buckets:

- `6` Fastify / HTTP / API questions
- `6` database / schema / lifecycle questions
- `5` scanner / GitHub / caching questions
- `4` Docker / Railway / deployment questions
- `4` metrics / security / auth questions
- `3` testing / trade-off questions
- `2` higher-level architecture or system-design boss fights

This keeps the page meaningful without becoming a marathon.

## Question Types

Use a mix of interaction styles so the page does not become repetitive.

### Single-choice

Use radio-button cards for questions with one clearly best answer, such as:

- why `/api/*` is protected
- what `last_seen_tag` means
- what happens on the first release scan

### Multi-choice

Use checkbox cards for questions where the user must identify multiple correct statements, such as:

- what Redis failure should and should not break
- what observability data is safe to expose in metrics
- what the interviewer might expect from a monolith explanation

### Flow order

Use ordered-step interactions for process questions, such as:

- subscribe -> confirm -> scan -> notify
- request -> route/plugin -> service -> repository -> external integration

These can be implemented with tap-to-sequence buttons rather than drag-and-drop so they work well on mobile.

### Boss fight scenarios

Use higher-pressure cards that present a short scenario and 3-4 candidate answers. These simulate the likely interview style of:

- “Why did you do it this way?”
- “What would you improve next?”
- “What happens if Redis is down?”
- “Why not microservices?”

## Answer And Feedback Format

Each question should reveal feedback immediately after submission.

Required feedback blocks:

- result state: correct or not quite
- correct answer reveal when the user misses
- short explanation: one compact paragraph
- interview-ready answer: a 2-4 line answer the user could say aloud
- deeper follow-up: one optional extra sentence for a stronger answer

The feedback must teach one sharp point, not dump a textbook.

Wrong-answer behavior:

- when the user answers incorrectly, reveal the correct answer or answers immediately
- show the short explanation and interview-ready phrasing
- offer a `Retry` action on the same question
- keep the question marked as missed for weak-spot tracking even if the retry later succeeds

## Game Mechanics

The page should feel playful but still useful.

Core mechanics:

- XP for each correct answer
- streak counter for consecutive correct answers
- progress bar across the full run
- topic badges unlocked by category mastery
- boss fights inserted after a small set of regular questions
- weak-spots queue that stores missed questions for replay

Scoring rule:

- the first wrong answer on a question breaks the streak and records a miss
- retrying is for learning and recovery, not for pretending the miss never happened

Optional flavor that should be included if it stays lightweight:

- fake achievement toasts such as `Rate Limit Survivor`, `Token Tamer`, and `Monolith Defender`
- humorous failure messages that stay short and readable
- a “bedtime cram mode” at the end that shows only shaky topics and short ideal answers

Avoid punitive mechanics like timers, lives, or harsh resets because the goal is confidence-building, not stress.

## Mobile-First Experience

Mobile support is required, not optional.

Design constraints:

- must be fully usable at widths around `360px`
- all actions must be tap-friendly
- no hover-only interactions
- no drag-dependent core interaction
- progress and score should remain visible without consuming too much vertical space
- answer explanations should be collapsible or compact enough not to create giant walls of text

Mobile-specific behaviors:

- use stacked layouts by default
- keep sticky top status small and readable
- make diagram sections horizontally constrained and readable without zoom
- size buttons for thumb use
- keep transitions short and optional
- honor `prefers-reduced-motion`

## Visual Direction

The page should feel like a silly retro arcade console for backend interview prep.

Tone:

- playful
- high-contrast
- mildly chaotic in a controlled way
- supportive rather than mocking

Visual ingredients:

- bold retro-inspired typography using safe fallback stacks
- neon or arcade-cabinet color palette
- card-based quiz arena
- fake badges, stickers, and meter widgets
- inline SVG diagrams and decorative icons

Because this route should remain lightweight and reliable, “memes and images” should be implemented primarily as:

- inline SVG stickers
- fake achievement cards
- humorous captions
- lightweight decorative panels

Do not depend on remote images, since they reduce reliability and may fail on mobile or offline.

## Runtime Surface

Add one new public route:

```text
GET /quiz
```

Behavior:

- returns the quiz arcade HTML page
- requires no API key
- does not call protected `/api/*` routes from the browser
- works as a read-only prep experience with all quiz content shipped in the page assets

This route is intentionally outside the Swagger-documented API surface. It is a public web page, not a contract-bearing API endpoint.

## Page Structure

The `/quiz` page should contain these major sections.

### 1. Intro Screen

Purpose:

- set the playful tone
- explain that the quiz is based on the course, task, and codebase
- show a `Start Run` action

Content:

- short intro copy
- category chips
- “you are slightly cooked but still dangerous” style humor

### 2. HUD / Progress Bar

Persistent compact top section showing:

- XP
- streak
- current question number
- category
- progress bar

On mobile, this must remain compact and sticky without covering too much of the viewport.

### 3. Quiz Arena

Main interactive region:

- question prompt
- answer options
- submit / check answer action
- feedback state
- continue action

This is the primary mode and should dominate the page experience.

### 4. Diagram Pit Stop

Interleave short visual explainers between groups of questions.

Suggested diagrams:

- request flow
- subscription lifecycle
- release scanner flow
- cache fallback path

Each diagram should include a one-line caption and a `Why this matters in an interview` note.

### 5. Boss Fight Cards

Insert harder scenario questions after each major cluster.

These should test reasoning, not memorization, and should feel like real follow-up questions from an interviewer.

### 6. Weak Spots Panel

At any point after answering a few questions, the user should be able to open a panel that shows:

- missed questions by topic
- count by category
- a `Retry Weak Spots` action

### 7. Bedtime Cram Sheet

Final section shown at the end of the run.

Content:

- weakest 3-5 topics
- short ideal spoken answers
- a compact “if they ask X, say Y” cheat sheet

This section exists specifically for late-night review on a phone.

## Diagram Plan

All diagrams should be inline SVG and simple enough to stay readable on mobile.

### Diagram 1: Request Surface

Show:

- browser user
- public web routes
- protected API routes
- shared subscription service
- PostgreSQL
- GitHub
- mailer

Key takeaway:

- the system has two request surfaces but shared business logic

### Diagram 2: Subscription Lifecycle

Show:

- pending
- confirmed
- active
- unsubscribed

Key takeaway:

- confirmation is separate from creation, and unsubscribe is stateful

### Diagram 3: Release Scanner

Show:

- scheduler tick
- list repositories
- fetch latest release
- compare with `last_seen_tag`
- baseline or notify
- update DB

Key takeaway:

- the first seen tag becomes the baseline, later changes trigger email

### Diagram 4: Cache Fallback

Show:

- app
- Redis cache hit/miss
- GitHub API
- fallback when Redis is unavailable

Key takeaway:

- cache improves efficiency but does not become a hard dependency

## Local State And Persistence

Use `localStorage` when available for:

- current score
- current question index
- streak
- missed question IDs
- completed question IDs
- optional mute/reduced-motion preference inside the page

If `localStorage` is unavailable, the page should keep working with in-memory state and simply avoid persistence.

## Interaction Model

State transitions:

1. user starts a run
2. user answers question
3. page evaluates correctness
4. if wrong, page reveals the correct answer, short explanation, and retry action
5. if correct, or once the user retries successfully, page reveals spoken-answer guidance and continue action
6. page awards XP only on a successful answer and updates streak according to the first-attempt result
7. page advances to the next question or boss fight
8. page occasionally pauses for a diagram pit stop
9. page ends in results + cram mode

Important UX rule:

- do not auto-advance immediately after answer selection; the user should have a clear moment to read feedback
- after a wrong answer, the retry flow should be obvious and lightweight rather than punitive

## Accessibility

The page should remain usable even though it is playful.

Required considerations:

- keyboard-accessible buttons and inputs
- clear focus states
- sufficient contrast
- semantic headings and form controls
- readable feedback text
- reduced-motion support
- no flashing or aggressive animation

## Error Handling And Robustness

Because the page is served by the app but runs fully client-side after load, the main failure modes are still local and should be handled gently.

Expected cases:

- malformed question data should fail gracefully and show a fallback message
- unavailable `localStorage` should not break the quiz
- restarting the run should fully reset local progress after confirmation
- narrow viewports should not break layout or hide essential actions
- a missing or broken quiz asset should fail clearly in development and be easy to catch with route-level tests

## Acceptance Criteria

- Opening `/quiz` locally and in the deployed app loads the quiz page successfully.
- The page is readable and usable on both desktop and mobile.
- The quiz includes approximately 30 codebase- and course-grounded questions.
- At least four diagrams are included and readable on mobile.
- The page supports radio, checkbox, and ordered-flow question types.
- The page tracks XP, streak, progress, and missed questions.
- The page reveals the correct answer and a short useful explanation after wrong answers.
- The page provides short interview-ready explanations after each answer.
- The page allows retrying the same question after a miss.
- The page offers a retry flow for missed questions.
- The page ends with a compact cram section for weak topics.
- The page contains playful visual and textual flavor without requiring external assets.
- The new route does not change the Swagger contract and does not require an API key.

## Implementation Notes

- Implement this as part of the existing Fastify web surface, not as a separate standalone file.
- Prefer a small structured question dataset in JavaScript rather than scattering content through the DOM.
- Keep explanations short enough for tired late-night review.
- Build mobile layout first, then scale up for desktop.
- Use inline SVG or same-origin assets for diagrams and decorative “achievement” art.
- Avoid external fonts, frameworks, and third-party image URLs.
- Follow the existing view/static-asset patterns already used by the current web UI.

## Risks And Mitigations

### Risk: too much content turns the page back into homework

Mitigation:

- cap the question count around 30
- keep answer explanations short
- interleave visuals and game mechanics

### Risk: game flavor overwhelms the actual prep value

Mitigation:

- every joke or badge must support pacing, not distract from the answer
- the primary output of each question remains a strong interview-ready explanation

### Risk: mobile layout becomes cramped

Mitigation:

- avoid drag-and-drop
- prefer single-column cards
- test around phone-sized widths during implementation

### Risk: the content becomes too generic

Mitigation:

- bias heavily toward questions grounded in the actual repository and task
- use course-level questions only as secondary enrichment
