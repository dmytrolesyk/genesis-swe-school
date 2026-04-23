// @ts-nocheck — browser module, tested via Vitest import
export const quizAchievements = [
  { id: 'rate-limit-survivor', label: 'Rate Limit Survivor' },
  { id: 'token-tamer', label: 'Token Tamer' },
  { id: 'monolith-defender', label: 'Monolith Defender' },
  { id: 'schema-sage', label: 'Schema Sage' },
  { id: 'cache-whisperer', label: 'Cache Whisperer' },
  { id: 'deploy-captain', label: 'Deploy Captain' }
]

export const quizDiagrams = [
  { id: 'request-surface', title: 'Request Surface', caption: 'Two entry points, one shared core.', interviewNote: 'Explain how public web routes and protected API routes share the same subscription service.' },
  { id: 'subscription-lifecycle', title: 'Subscription Lifecycle', caption: 'Pending → Confirmed → Active → Unsubscribed.', interviewNote: 'Confirmation is separate from creation. Unsubscribe is stateful, not destructive.' },
  { id: 'release-scanner', title: 'Release Scanner', caption: 'Poll, compare, baseline or notify.', interviewNote: 'The first seen tag becomes the baseline — no spam on first scan.' },
  { id: 'cache-fallback', title: 'Cache Fallback', caption: 'Redis helps, but never blocks.', interviewNote: 'Explain why the app degrades gracefully when Redis is unavailable.' }
]

export const quizQuestions = [
  // ── api (6) ──────────────────────────────────────────────
  {
    id: 'api-protected-routes',
    category: 'api',
    kind: 'single',
    prompt: 'Why are /api/* routes protected with x-api-key while /quiz stays public?',
    options: [
      { id: 'a', label: 'Browsers cannot send custom headers' },
      { id: 'b', label: 'The quiz is read-only public content; /api/* is the programmatic app surface' },
      { id: 'c', label: 'Fastify only supports auth under /api' }
    ],
    correctOptionIds: ['b'],
    explanation: 'The API surface exposes application behavior and data operations that should be gated. The quiz is just static learning content.',
    interviewAnswer: 'I kept /quiz public because it is static prep content. /api/* stays protected because those routes expose real application behavior.',
    deeperFollowUp: 'If the quiz ever became user-specific, I would add its own auth layer instead of reusing the API key.'
  },
  {
    id: 'api-fastify-choice',
    category: 'api',
    kind: 'single',
    prompt: 'Why was Fastify chosen over Express for this service?',
    options: [
      { id: 'a', label: 'Fastify has built-in JSON schema validation, a plugin system, and better performance' },
      { id: 'b', label: 'Express does not support TypeScript' },
      { id: 'c', label: 'Fastify is the only Node.js framework with PostgreSQL support' }
    ],
    correctOptionIds: ['a'],
    explanation: 'Fastify offers a structured plugin system, native schema validation, and high throughput — all useful for a production API monolith.',
    interviewAnswer: 'I chose Fastify for its plugin architecture, built-in schema validation, and performance. The plugin encapsulation also keeps concerns separated cleanly.',
    deeperFollowUp: 'The Fastify lifecycle hooks also simplify request-level instrumentation and error handling.'
  },
  {
    id: 'api-uuid-validation',
    category: 'api',
    kind: 'single',
    prompt: 'Why validate that a token is a UUID before hitting the database?',
    options: [
      { id: 'a', label: 'UUIDs are required by the Swagger spec' },
      { id: 'b', label: 'It avoids a pointless DB round-trip and prevents injection with malformed strings' },
      { id: 'c', label: 'PostgreSQL crashes on non-UUID input' }
    ],
    correctOptionIds: ['b'],
    explanation: 'Validating format early rejects obviously invalid input without wasting a database query or risking unexpected behavior.',
    interviewAnswer: 'I validate the UUID format before the DB lookup to fail fast on garbage input. It saves a round-trip and adds a small safety layer.',
    deeperFollowUp: 'PostgreSQL would error on an invalid UUID cast anyway, but catching it at the route level gives cleaner error messages.'
  },
  {
    id: 'api-status-codes',
    category: 'api',
    kind: 'multi',
    prompt: 'Which HTTP status codes does the API return for these error cases? (select all correct)',
    options: [
      { id: 'a', label: '400 for invalid input format' },
      { id: 'b', label: '401 for missing or wrong API key' },
      { id: 'c', label: '404 for unknown subscription token' },
      { id: 'd', label: '500 for all validation errors' }
    ],
    correctOptionIds: ['a', 'b', 'c'],
    explanation: 'The API uses 400 for bad input, 401 for auth failures, and 404 for missing resources. 500 is reserved for unexpected server errors.',
    interviewAnswer: '400 for invalid format, 401 for missing API key, 404 for tokens that do not match any subscription, and 409 for duplicates.',
    deeperFollowUp: 'Returning precise status codes makes the API self-documenting and easier for clients to handle programmatically.'
  },
  {
    id: 'api-idempotency',
    category: 'api',
    kind: 'single',
    prompt: 'What happens if a user subscribes to the same repo and email twice?',
    options: [
      { id: 'a', label: 'A duplicate subscription is created' },
      { id: 'b', label: 'The API returns 409 Conflict' },
      { id: 'c', label: 'The server crashes with a unique constraint error' }
    ],
    correctOptionIds: ['b'],
    explanation: 'The service checks for existing confirmed subscriptions and returns 409 to prevent duplicates instead of letting the DB constraint fail.',
    interviewAnswer: 'Duplicate subscriptions return 409 Conflict. The service checks before insert so the client gets a clear, actionable error.',
    deeperFollowUp: 'For pending (unconfirmed) duplicates, the system resends the confirmation email instead of rejecting the request.'
  },
  {
    id: 'api-route-split',
    category: 'api',
    kind: 'multi',
    prompt: 'What are the benefits of splitting web routes and API routes into separate Fastify plugins? (select all correct)',
    options: [
      { id: 'a', label: 'Auth middleware only applies to /api/* automatically' },
      { id: 'b', label: 'Each plugin has its own encapsulated context' },
      { id: 'c', label: 'It prevents the quiz from accidentally requiring an API key' },
      { id: 'd', label: 'Web routes cannot use JSON responses' }
    ],
    correctOptionIds: ['a', 'b', 'c'],
    explanation: 'Fastify plugin encapsulation means decorators and hooks registered in the /api plugin do not leak into the web plugin, and vice versa.',
    interviewAnswer: 'Splitting into plugins uses Fastify encapsulation. The API key guard is scoped to /api/*, so web routes stay public by design.',
    deeperFollowUp: 'This pattern also makes it easy to add rate limiting or CORS rules to just one surface without affecting the other.'
  },

  // ── database (6) ─────────────────────────────────────────
  {
    id: 'db-source-of-truth',
    category: 'database',
    kind: 'single',
    prompt: 'Why is PostgreSQL the source of truth rather than Redis?',
    options: [
      { id: 'a', label: 'PostgreSQL supports ACID transactions and durable storage; Redis is an ephemeral cache' },
      { id: 'b', label: 'Redis does not support key-value lookups' },
      { id: 'c', label: 'PostgreSQL is faster than Redis for all operations' }
    ],
    correctOptionIds: ['a'],
    explanation: 'Subscriptions and repository state need durable, transactional storage. Redis is used only as an optional performance cache.',
    interviewAnswer: 'PostgreSQL is the source of truth because subscription data must survive restarts and needs transactional guarantees. Redis is just a cache layer.',
    deeperFollowUp: 'If Redis loses all data, the app continues working — it just makes more GitHub API calls until the cache warms up again.'
  },
  {
    id: 'db-last-seen-tag',
    category: 'database',
    kind: 'single',
    prompt: 'What is the purpose of last_seen_tag in the repositories table?',
    options: [
      { id: 'a', label: 'It stores the latest release tag so the scanner can detect new ones' },
      { id: 'b', label: 'It caches the GitHub repository name' },
      { id: 'c', label: 'It tracks which tags the user has clicked' }
    ],
    correctOptionIds: ['a'],
    explanation: 'The scanner compares the current latest release against last_seen_tag. A mismatch means a new release has been published.',
    interviewAnswer: 'last_seen_tag stores the most recently observed release. Each scan compares GitHub\'s latest tag against it to detect new releases.',
    deeperFollowUp: 'On the very first scan, last_seen_tag is null, so the scanner stores the current tag as a baseline instead of sending notifications.'
  },
  {
    id: 'db-separate-tables',
    category: 'database',
    kind: 'single',
    prompt: 'Why are subscriptions and repositories stored in separate tables?',
    options: [
      { id: 'a', label: 'Multiple users can subscribe to the same repo; the repo row is shared' },
      { id: 'b', label: 'PostgreSQL cannot store JSON in a single table' },
      { id: 'c', label: 'Each table must map to one API endpoint' }
    ],
    correctOptionIds: ['a'],
    explanation: 'Normalizing avoids duplicating repository metadata per subscription. One repo row, many subscription rows pointing to it.',
    interviewAnswer: 'Repos are shared across subscribers, so normalizing into a separate table avoids redundant data and keeps last_seen_tag in one place.',
    deeperFollowUp: 'This also means the scanner only checks each repo once per cycle, regardless of how many subscribers are watching it.'
  },
  {
    id: 'db-migrations',
    category: 'database',
    kind: 'single',
    prompt: 'When do database migrations run in this project?',
    options: [
      { id: 'a', label: 'Manually via a separate CLI tool before each deploy' },
      { id: 'b', label: 'Automatically on application startup' },
      { id: 'c', label: 'Only when Docker Compose is rebuilt' }
    ],
    correctOptionIds: ['b'],
    explanation: 'Migrations run on startup so the schema is always up to date when the app begins accepting requests.',
    interviewAnswer: 'Migrations run automatically when the app starts. This keeps the schema in sync with the code without manual steps.',
    deeperFollowUp: 'For larger teams, startup migrations can cause issues with rolling deploys. A migration-first deploy step would be safer at scale.'
  },
  {
    id: 'db-confirmation-token',
    category: 'database',
    kind: 'single',
    prompt: 'Why does each subscription have its own confirmation token?',
    options: [
      { id: 'a', label: 'To allow email confirmation without requiring login or session state' },
      { id: 'b', label: 'To encrypt the subscription data' },
      { id: 'c', label: 'To prevent SQL injection' }
    ],
    correctOptionIds: ['a'],
    explanation: 'The token is a one-time-use secret embedded in the confirmation email. It proves email ownership without any auth session.',
    interviewAnswer: 'The confirmation token proves the user owns the email. No login required — just click the link with the unique token.',
    deeperFollowUp: 'The unsubscribe link works the same way: a unique token per subscription so the user can opt out without authentication.'
  },
  {
    id: 'db-indexes',
    category: 'database',
    kind: 'multi',
    prompt: 'Which columns benefit from indexes in this schema? (select all correct)',
    options: [
      { id: 'a', label: 'subscriptions.confirmation_token for token lookups' },
      { id: 'b', label: 'subscriptions.email for listing by user' },
      { id: 'c', label: 'repositories.owner_repo for unique constraint and lookups' },
      { id: 'd', label: 'repositories.last_seen_tag for sorting' }
    ],
    correctOptionIds: ['a', 'b', 'c'],
    explanation: 'Token lookups, email queries, and repo uniqueness checks are the hot paths. Indexing last_seen_tag would not help because scans iterate all repos.',
    interviewAnswer: 'I index confirmation_token, email, and owner_repo because those are the primary lookup paths. last_seen_tag is only read during full scans.',
    deeperFollowUp: 'PostgreSQL creates indexes automatically for primary keys and unique constraints, but explicit indexes on lookup columns ensure fast queries.'
  },

  // ── scanner (5) ──────────────────────────────────────────
  {
    id: 'scanner-baseline',
    category: 'scanner',
    kind: 'single',
    prompt: 'What happens when the release scanner sees a repository for the first time?',
    options: [
      { id: 'a', label: 'It sends a notification about the current release' },
      { id: 'b', label: 'It stores the current tag as the baseline and sends nothing' },
      { id: 'c', label: 'It skips the repository until a second scan' }
    ],
    correctOptionIds: ['b'],
    diagramId: 'release-scanner',
    explanation: 'The first scan establishes last_seen_tag without triggering notifications. This prevents a flood of emails for existing releases.',
    interviewAnswer: 'The first scan sets the baseline. It stores the current tag in last_seen_tag so only genuinely new releases trigger emails.',
    deeperFollowUp: 'Without baselining, every subscriber would get a notification for whatever the latest release already was — not a useful signal.'
  },
  {
    id: 'scanner-polling-vs-webhook',
    category: 'scanner',
    kind: 'single',
    prompt: 'Why does the scanner use polling instead of GitHub webhooks?',
    options: [
      { id: 'a', label: 'Polling is simpler: no public URL, no webhook registration, no secret management' },
      { id: 'b', label: 'GitHub does not support release webhooks' },
      { id: 'c', label: 'Webhooks would require a microservice architecture' }
    ],
    correctOptionIds: ['a'],
    explanation: 'Polling keeps the system self-contained. No inbound route, no GitHub App registration, and no webhook secret verification needed.',
    interviewAnswer: 'Polling is simpler for this scope — no public endpoint, no webhook secrets, and it still catches releases within the scan interval.',
    deeperFollowUp: 'Webhooks would give real-time detection but add operational complexity. For a low-frequency event like releases, polling is a pragmatic choice.'
  },
  {
    id: 'scanner-rate-limits',
    category: 'scanner',
    kind: 'multi',
    prompt: 'How does the app handle GitHub API rate limits? (select all correct)',
    options: [
      { id: 'a', label: 'Uses conditional requests with ETags to reduce counted calls' },
      { id: 'b', label: 'Caches GitHub responses in Redis to avoid repeated fetches' },
      { id: 'c', label: 'Tracks remaining quota via response headers' },
      { id: 'd', label: 'Falls back to scraping the GitHub HTML page' }
    ],
    correctOptionIds: ['a', 'b', 'c'],
    achievementId: 'rate-limit-survivor',
    explanation: 'ETags, Redis caching, and header-based quota tracking all reduce the effective API call rate without scraping or breaking ToS.',
    interviewAnswer: 'I use ETags for conditional requests, Redis to cache responses, and I monitor rate-limit headers. Together they keep usage well under the limit.',
    deeperFollowUp: 'If the quota runs low, the scanner can back off gracefully. The important thing is that it never silently fails or loses data.'
  },
  {
    id: 'scanner-flow-order',
    category: 'scanner',
    kind: 'order',
    prompt: 'Order the release scanner steps from start to finish.',
    options: [
      { id: 'a', label: 'Scheduler tick fires' },
      { id: 'b', label: 'List all tracked repositories' },
      { id: 'c', label: 'Fetch latest release from GitHub' },
      { id: 'd', label: 'Compare with last_seen_tag' },
      { id: 'e', label: 'Send notifications or set baseline' },
      { id: 'f', label: 'Update last_seen_tag in DB' }
    ],
    correctOptionIds: ['a', 'b', 'c', 'd', 'e', 'f'],
    diagramId: 'release-scanner',
    explanation: 'The scanner follows a strict sequence: trigger → fetch repos → check each against GitHub → compare tags → act → persist.',
    interviewAnswer: 'The scanner ticks on a schedule, loads repos, fetches the latest release for each, compares tags, notifies or baselines, then updates the DB.',
    deeperFollowUp: 'Each step can fail independently. If one repo fails, the scanner continues with the rest and logs the error.'
  },
  {
    id: 'scanner-cache-miss',
    category: 'scanner',
    kind: 'single',
    prompt: 'What happens when the scanner checks a repo and Redis is down?',
    options: [
      { id: 'a', label: 'The scanner crashes and retries on the next tick' },
      { id: 'b', label: 'It skips caching and fetches directly from GitHub' },
      { id: 'c', label: 'It returns stale data from PostgreSQL' }
    ],
    correctOptionIds: ['b'],
    diagramId: 'cache-fallback',
    achievementId: 'cache-whisperer',
    explanation: 'Redis is optional. When it is unavailable, the GitHub client falls back to a direct API call — slower but functional.',
    interviewAnswer: 'If Redis is down, the app skips the cache and calls GitHub directly. It is slower but still correct. No data loss, no crash.',
    deeperFollowUp: 'This is the graceful degradation pattern: the cache is a performance optimization, not a correctness dependency.'
  },

  // ── deployment (4) ───────────────────────────────────────
  {
    id: 'deploy-docker-compose',
    category: 'deployment',
    kind: 'multi',
    prompt: 'What services does Docker Compose provide for local development? (select all correct)',
    options: [
      { id: 'a', label: 'PostgreSQL database' },
      { id: 'b', label: 'Redis cache' },
      { id: 'c', label: 'The Fastify app itself' },
      { id: 'd', label: 'A GitHub API mock' }
    ],
    correctOptionIds: ['a', 'b'],
    explanation: 'Docker Compose runs Postgres and Redis. The app itself runs on the host via pnpm dev, and GitHub is called directly.',
    interviewAnswer: 'Docker Compose gives me Postgres and Redis locally. The app runs on the host with pnpm dev, hitting real GitHub for releases.',
    deeperFollowUp: 'Keeping the app outside Compose makes development iteration faster — no rebuild on every code change.'
  },
  {
    id: 'deploy-railway-vars',
    category: 'deployment',
    kind: 'multi',
    prompt: 'Which environment variables are required for a Railway deployment? (select all correct)',
    options: [
      { id: 'a', label: 'DATABASE_URL for PostgreSQL' },
      { id: 'b', label: 'GITHUB_TOKEN for API access' },
      { id: 'c', label: 'API_KEY for protecting /api/* routes' },
      { id: 'd', label: 'REDIS_URL (optional but recommended)' }
    ],
    correctOptionIds: ['a', 'b', 'c', 'd'],
    achievementId: 'deploy-captain',
    explanation: 'DATABASE_URL, GITHUB_TOKEN, and API_KEY are required. REDIS_URL is optional because the app degrades gracefully without it.',
    interviewAnswer: 'DATABASE_URL, GITHUB_TOKEN, and API_KEY are must-haves. REDIS_URL is optional — the app works without Redis, just slower.',
    deeperFollowUp: 'Railway injects DATABASE_URL and REDIS_URL automatically when you link services. GITHUB_TOKEN and API_KEY are set manually.'
  },
  {
    id: 'deploy-why-docker',
    category: 'deployment',
    kind: 'single',
    prompt: 'Why does the assignment require Docker support?',
    options: [
      { id: 'a', label: 'So evaluators can run the full stack with one command, regardless of their local setup' },
      { id: 'b', label: 'Docker is required by Railway for deployment' },
      { id: 'c', label: 'Node.js applications cannot run without Docker' }
    ],
    correctOptionIds: ['a'],
    explanation: 'Docker ensures a reproducible environment for evaluation. One docker compose up and everything works.',
    interviewAnswer: 'Docker lets evaluators spin up the full stack without installing Postgres, Redis, or Node locally. One command, consistent results.',
    deeperFollowUp: 'Railway uses Nixpacks by default, not Docker, but Docker Compose is the local development and evaluation story.'
  },
  {
    id: 'deploy-monolith-choice',
    category: 'deployment',
    kind: 'single',
    prompt: 'Why is this deployed as a single Railway service instead of separate microservices?',
    options: [
      { id: 'a', label: 'The task explicitly keeps API, scanner, and notifier together and the scope does not justify distributed overhead' },
      { id: 'b', label: 'Railway does not support multiple services' },
      { id: 'c', label: 'Microservices require Kubernetes' }
    ],
    correctOptionIds: ['a'],
    explanation: 'A monolith is the right fit for this scope. The assignment keeps all components together, and splitting would add network, deployment, and consistency overhead.',
    interviewAnswer: 'The assignment scope fits a monolith. Splitting into microservices would add network hops, deployment complexity, and data consistency challenges without real benefits at this scale.',
    deeperFollowUp: 'If the scanner needed independent scaling or the notifier needed its own retry queue, microservices might start making sense.'
  },

  // ── security (4) ─────────────────────────────────────────
  {
    id: 'security-api-key-guard',
    category: 'security',
    kind: 'single',
    prompt: 'How does the API key guard work in this codebase?',
    options: [
      { id: 'a', label: 'A Fastify onRequest hook checks x-api-key against the configured API_KEY' },
      { id: 'b', label: 'Each route handler manually validates the key' },
      { id: 'c', label: 'A middleware checks the Authorization: Bearer header' }
    ],
    correctOptionIds: ['a'],
    achievementId: 'token-tamer',
    explanation: 'The API key auth is a Fastify plugin registered in the /api encapsulated context. It runs as an onRequest hook before any route handler.',
    interviewAnswer: 'It is a Fastify plugin with an onRequest hook. Registered under /api, it checks x-api-key and returns 401 if it is missing or wrong.',
    deeperFollowUp: 'Because it is encapsulated to the /api prefix, web routes never see this hook. Fastify plugin scoping makes this automatic.'
  },
  {
    id: 'security-metrics-protection',
    category: 'security',
    kind: 'single',
    prompt: 'Why are the /metrics endpoint protected?',
    options: [
      { id: 'a', label: 'Metrics can reveal internal system behavior, error rates, and usage patterns' },
      { id: 'b', label: 'Prometheus requires authentication by default' },
      { id: 'c', label: 'Metrics responses are too large for public access' }
    ],
    correctOptionIds: ['a'],
    explanation: 'Exposing metrics publicly leaks operational data. Protecting them limits access to authorized monitoring tools.',
    interviewAnswer: 'Metrics reveal error rates, request patterns, and system internals. Protecting them prevents information leakage to unauthorized users.',
    deeperFollowUp: 'Even seemingly harmless counters can reveal traffic volume or error spikes that an attacker could exploit.'
  },
  {
    id: 'security-token-lifecycle',
    category: 'security',
    kind: 'order',
    prompt: 'Order the subscription security lifecycle from start to finish.',
    options: [
      { id: 'a', label: 'User submits email and repo' },
      { id: 'b', label: 'Server generates a unique confirmation token' },
      { id: 'c', label: 'Confirmation email is sent with the token link' },
      { id: 'd', label: 'User clicks the link to confirm' },
      { id: 'e', label: 'Server marks subscription as confirmed' }
    ],
    correctOptionIds: ['a', 'b', 'c', 'd', 'e'],
    diagramId: 'subscription-lifecycle',
    explanation: 'The token proves email ownership. No session, no password — just a one-time link that confirms the subscription.',
    interviewAnswer: 'The user subscribes, a token is generated and emailed, and clicking the link confirms ownership. No login needed.',
    deeperFollowUp: 'Unsubscribe works the same way — a unique token per subscription, sent in every notification email.'
  },
  {
    id: 'security-redis-exposure',
    category: 'security',
    kind: 'multi',
    prompt: 'What data is safe to cache in Redis? (select all correct)',
    options: [
      { id: 'a', label: 'GitHub release metadata (tag name, URL)' },
      { id: 'b', label: 'Confirmation tokens' },
      { id: 'c', label: 'Repository existence check results' },
      { id: 'd', label: 'User email addresses' }
    ],
    correctOptionIds: ['a', 'c'],
    explanation: 'Public GitHub data and repo validation results are safe to cache. Tokens and emails are sensitive and should stay in PostgreSQL.',
    interviewAnswer: 'I cache GitHub release data and repo checks — public information. Tokens and emails stay in PostgreSQL only.',
    deeperFollowUp: 'Redis data can be evicted or lost at any time. Only cache data you can safely refetch or regenerate.'
  },

  // ── testing (3) ──────────────────────────────────────────
  {
    id: 'testing-strategy',
    category: 'testing',
    kind: 'multi',
    prompt: 'How are tests organized in this codebase? (select all correct)',
    options: [
      { id: 'a', label: 'Route tests use Fastify inject() to test HTTP behavior' },
      { id: 'b', label: 'Service tests use stubs to isolate business logic' },
      { id: 'c', label: 'Plugin tests verify decoration and lifecycle hooks' },
      { id: 'd', label: 'All tests hit the real database' }
    ],
    correctOptionIds: ['a', 'b', 'c'],
    explanation: 'Tests are split by concern: route tests check HTTP, service tests check logic, plugin tests check integration. No real DB needed.',
    interviewAnswer: 'Route tests use inject() for HTTP, service tests use stubs for business logic, plugin tests verify Fastify decorators. No real database.',
    deeperFollowUp: 'This split makes tests fast and independent. Each layer is tested in isolation with clear boundaries.'
  },
  {
    id: 'testing-inject',
    category: 'testing',
    kind: 'single',
    prompt: 'Why use Fastify\'s inject() method instead of starting the server and making real HTTP requests?',
    options: [
      { id: 'a', label: 'inject() is faster — no TCP overhead — and tests the full request lifecycle in-process' },
      { id: 'b', label: 'Fastify does not support listening on a port in tests' },
      { id: 'c', label: 'Real HTTP requests cannot send custom headers' }
    ],
    correctOptionIds: ['a'],
    explanation: 'inject() simulates the full Fastify lifecycle without network I/O, making tests fast and deterministic.',
    interviewAnswer: 'inject() runs the full Fastify pipeline in-process — no port, no TCP — so tests are fast and reliable.',
    deeperFollowUp: 'It also means tests can run in parallel without port conflicts, and there is no flaky network layer.'
  },
  {
    id: 'testing-tradeoffs',
    category: 'testing',
    kind: 'boss',
    prompt: 'An interviewer asks: "Your tests use stubs instead of a real database. What tradeoffs does that introduce?"',
    options: [
      { id: 'a', label: 'Stubs are faster but can drift from real DB behavior. I would add integration tests for critical paths.' },
      { id: 'b', label: 'Stubs are always better because they never fail' },
      { id: 'c', label: 'There are no tradeoffs — stubs perfectly simulate PostgreSQL' },
      { id: 'd', label: 'I would remove all stubs and only test against the real database' }
    ],
    correctOptionIds: ['a'],
    explanation: 'Stubs trade speed for fidelity. They test logic in isolation but can miss real DB edge cases like constraint violations or query semantics.',
    interviewAnswer: 'Stubs keep tests fast and independent, but they can drift from real Postgres behavior. For critical flows, I would add integration tests that hit a real database.',
    deeperFollowUp: 'A good test pyramid has many unit tests with stubs, some integration tests with a real DB, and a few end-to-end smoke tests.'
  },

  // ── architecture (2) ─────────────────────────────────────
  {
    id: 'arch-monolith-vs-micro',
    category: 'architecture',
    kind: 'boss',
    prompt: 'An interviewer asks: "Why not split this into microservices from the start?"',
    options: [
      { id: 'a', label: 'Microservices add network, deployment, and consistency overhead that this scope does not justify' },
      { id: 'b', label: 'Monoliths are always better than microservices' },
      { id: 'c', label: 'I did not have time to set up Kubernetes' },
      { id: 'd', label: 'Fastify does not support microservice architectures' }
    ],
    correctOptionIds: ['a'],
    achievementId: 'monolith-defender',
    diagramId: 'request-surface',
    explanation: 'A monolith is the right starting point for this scope. Microservices are an optimization for specific scaling or team-boundary problems.',
    interviewAnswer: 'This scope fits a monolith. Microservices would add network hops, deployment complexity, and distributed data challenges without solving a real problem here.',
    deeperFollowUp: 'If the scanner needed independent scaling or teams owned different components, microservices would start to make sense.'
  },
  {
    id: 'arch-layered',
    category: 'architecture',
    kind: 'boss',
    prompt: 'An interviewer asks: "Walk me through the architectural layers in your codebase."',
    options: [
      { id: 'a', label: 'Routes → Service → Repository → Database, with plugins for cross-cutting concerns' },
      { id: 'b', label: 'Controller → Model → View, like a standard MVC framework' },
      { id: 'c', label: 'There are no layers — everything is in the route handlers' },
      { id: 'd', label: 'Microservices communicate via message queues' }
    ],
    correctOptionIds: ['a'],
    explanation: 'The codebase follows a layered architecture: routes handle HTTP, services contain business logic, repositories abstract the database, and plugins provide infrastructure.',
    interviewAnswer: 'Routes handle HTTP concerns, services hold business logic, repositories wrap database access, and Fastify plugins provide infrastructure like config, caching, and auth.',
    deeperFollowUp: 'This layering means I can test each concern independently and swap implementations without rewriting the layer above.'
  }
]
