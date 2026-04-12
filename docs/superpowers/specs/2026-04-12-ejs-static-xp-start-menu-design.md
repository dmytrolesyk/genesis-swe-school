# Web UI Design: EJS, Static Assets, XP Start Menu

## Status

Approved during brainstorming on 2026-04-12.

## Context

The project is a single Fastify service for GitHub release email notifications. The Swagger API contract in `swagger.yaml` is fixed. Protected API routes under `/api` already include `GET /api/subscriptions?email=...`, but browser JavaScript must not receive or embed the API key.

The current public web UI is rendered by TypeScript string builders in `src/features/web/templates.ts`. CSS is inline in those strings, and the page currently uses a blue/green gradient background. The repository also contains `static/images/bg.jpg`, a 1600x900 90s collage background image intended for the refreshed UI.

This design replaces the hand-built HTML strings with proper Fastify view rendering, moves CSS and client JavaScript into static files, and adds a Windows XP-style taskbar and nested start menu.

## Goals

- Replace string-built HTML with EJS templates rendered through the current Fastify view plugin.
- Extract CSS into static stylesheet files.
- Add static asset serving for CSS, JavaScript, and `static/images/bg.jpg`.
- Keep the subscription form as a normal server-rendered `POST /subscribe` flow.
- Add a browser-enhanced Windows XP-style taskbar with a live clock.
- Add a start menu with nested panels for My Subscriptions, Account, Preferences, and About.
- Use vanilla browser JavaScript with no frontend build step.
- Keep protected `/api/*` behavior and the Swagger contract unchanged.

## Non-Goals

- No React, Preact, Alpine, bundler, or separate frontend app.
- No login, sessions, magic links, or manage-account tokens in this iteration.
- No changes to `swagger.yaml`.
- No browser requests to protected `/api/*`.
- No new database tables or migrations for UI preferences.

## Privacy Decision

The start menu will use a public web endpoint that accepts an email address and returns that email's subscriptions. This is a conscious demo-app tradeoff: anyone who knows an email address can query its subscribed repositories.

A more secure future version can replace this with a magic-link access flow and an `HttpOnly` cookie, but that is outside this iteration.

## Server Rendering

Use `@fastify/view` with EJS. The historical `point-of-view` package name should not be used directly; `@fastify/view` is the current Fastify plugin.

Suggested files:

```text
src/features/web/views/layout.ejs
src/features/web/views/home.ejs
src/features/web/views/token-result.ejs
```

The layout should include:

- document metadata
- links to static CSS and JavaScript
- the background image through CSS
- taskbar/start-menu markup shared across the home and token result pages

EJS should escape dynamic text by default with `<%= ... %>`. Avoid unescaped `<%- ... %>` except for trusted template partials controlled by the application.

## Static Assets

Use `@fastify/static` for files under `static/`.

Suggested public paths:

```text
/assets/styles/app.css
/assets/scripts/app.js
/assets/images/bg.jpg
```

Suggested source files:

```text
static/styles/app.css
static/scripts/app.js
static/images/bg.jpg
```

The CSS should use `static/images/bg.jpg` as the page background instead of the current blue/green gradient. Add an overlay or brightness treatment so the central window and start menu stay readable against the busy collage.

## Public Web Routes

Keep existing public routes:

```text
GET  /
POST /subscribe
GET  /confirm/:token
GET  /unsubscribe/:token
```

Add one public web JSON endpoint:

```text
GET /subscriptions?email=user@example.com
```

Behavior:

- Validate that `email` is a string and has an email shape.
- Return `400` for missing or invalid email.
- Call `service.getSubscriptionsByEmail(email)` internally.
- Return the same subscription item shape used by the protected API:

```json
[
  {
    "email": "user@example.com",
    "repo": "nodejs/node",
    "confirmed": true,
    "last_seen_tag": "v1.0.0"
  }
]
```

This endpoint is intentionally outside `/api` so the protected Swagger API remains unchanged and API-key guarded.

## Subscription Form Behavior

The main subscription form remains a normal HTML form:

```text
POST /subscribe
Content-Type: application/x-www-form-urlencoded
```

JavaScript should only progressively enhance it by storing the submitted email in `localStorage` immediately before the normal form submission continues.

The server still returns an HTML success or error page. The form continues to work if JavaScript is disabled.

## Client JavaScript

Use a vanilla browser module at `static/scripts/app.js`.

Responsibilities:

- Store the submitted subscription email in `localStorage`.
- Toggle the start menu from the taskbar Start button.
- Close the start menu on Escape and outside click.
- Update the toolbar clock.
- Read and write local UI preferences.
- Render nested start menu panels.
- Fetch subscriptions only when the user explicitly presses a load button.
- Render fetched subscription data with safe DOM APIs such as `textContent`, `createElement`, and `append`.

Avoid `innerHTML` for data from `localStorage`, URL parameters, or fetch responses.

## Start Menu

The taskbar sits at the bottom of the viewport.

Left side:

- Start button

Right side:

- toolbar area
- live clock

The start menu opens above the Start button and contains nested panels.

### My Subscriptions

If no email is saved in `localStorage`, show an email field and a save button.

If an email is saved, show:

- the saved email
- explicit Load subscriptions button
- loading/error/empty states
- a list of repos
- confirmed/pending state
- last seen tag when present
- GitHub links for each repo

Changing the email in Account does not auto-fetch. The user must press Load subscriptions.

### Account

Local-only panel:

- show saved email if present
- allow saving a new email
- allow clearing the saved email
- allow clearing all local UI data

### Preferences

Local-only panel:

- clock format: 12-hour or 24-hour
- background dim: normal or stronger
- motion: normal or reduced
- menu density: cozy or compact

Persist preferences in `localStorage` and apply them through document classes or data attributes.

### About

Static panel explaining:

- subscriptions require email confirmation
- pending subscriptions may appear until confirmed
- unsubscribe links are sent by email
- the taskbar remembers only local browser preferences and saved email

## Error Handling

Server route errors:

- Invalid public subscription lookup email returns `400`.
- Unexpected lookup errors return the existing centralized error response behavior.
- Existing HTML form errors still render an HTML error state.

Client errors:

- Network failures in My Subscriptions show a non-technical error state.
- Invalid email in start menu Account/My Subscriptions blocks the fetch and asks for a valid email.
- Empty results show a friendly empty state.

## Testing

Add or update tests for:

- `GET /` renders through the view path and includes links to CSS and JS assets.
- `GET /assets/styles/app.css`, `GET /assets/scripts/app.js`, and `GET /assets/images/bg.jpg` are served.
- `POST /subscribe` remains a normal form POST and calls the subscription service.
- Successful form responses still render HTML status text.
- Error form responses still render HTML error text and preserve submitted values.
- `GET /confirm/:token` and `GET /unsubscribe/:token` still render public HTML without an API key.
- `GET /subscriptions?email=user@example.com` works without an API key and calls `service.getSubscriptionsByEmail`.
- `GET /subscriptions?email=bad` returns `400`.
- Protected `GET /api/subscriptions?email=...` still requires `x-api-key`.

Manual browser smoke after implementation:

- The background image loads.
- The taskbar is visible on desktop and mobile.
- The Start button opens and closes the menu.
- The clock updates.
- My Subscriptions loads data for a saved email.
- Preferences persist after refresh.

## Accessibility And Robustness

- Start button should expose `aria-expanded` and `aria-controls`.
- Panels should use buttons for navigation, not clickable divs.
- Focus should remain usable with keyboard navigation.
- Use readable contrast over the background image.
- Respect `prefers-reduced-motion` and the local reduced-motion preference.
- Keep text responsive and avoid viewport-scaled font sizes.

## Implementation Notes

- Use existing Fastify route/plugin patterns.
- Keep the web route service dependency injection shape so tests can pass a stubbed `SubscriptionService`.
- Keep route tests with Fastify `inject()`.
- Do not move protected API behavior into the public web endpoint.
- Keep client-side rendering small enough that no frontend test runner or bundler is required for this iteration.
