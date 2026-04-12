# AGENTS.md

## Scope
- This file applies to the whole repository until more specific `AGENTS.md` files are added.

## Start here
- Before changing API behavior, read `task.md` and `swagger.yaml`; the Swagger contract is fixed unless the user explicitly asks to change it.
- For feature work, read `docs/superpowers/plans/2026-04-08-github-release-notification-api.md` for the agreed architecture, original implementation sequence, and required skill routing.
- For the current extras work, read `docs/superpowers/specs/2026-04-11-extras-ci-railway-auth-cache-metrics-web-design.md` and `docs/superpowers/plans/2026-04-11-extras-ci-railway-auth-cache-metrics-web.md`; implement the steps in order and follow their mandatory skill routing for Railway, Resend, Redis, Postgres, Node, Fastify, TypeScript, and ESLint work.

## Plan caveats
- The plan checkboxes were not kept as the source of truth after implementation; do not treat unchecked boxes as pending without checking code, tests, and git history.
- When extending planned work, keep changes feature-by-feature instead of bundling unrelated slices, and follow the plan's skill routing for ESLint, Node, Fastify, and TypeScript work.
