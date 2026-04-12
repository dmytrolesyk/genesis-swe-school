export type HomePageStatus = {
  kind: 'error' | 'success'
  message: string
}

export type HomePageValues = Partial<{
  email: string
  repo: string
}>

export type TokenPageState = 'success' | 'failure'

const githubMarkUrl =
  'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'

function escapeHtml (value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function renderPageShell (input: {
  body: string
  title: string
}): string {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(input.title)}</title>`,
    '<style>',
    `body {
  margin: 0;
  min-height: 100vh;
  font-family: Tahoma, Verdana, Arial, sans-serif;
  color: #161616;
  background: linear-gradient(180deg, #3a8dde 0%, #6db9ff 52%, #3b7f2d 52%, #71b34b 100%);
}

* {
  box-sizing: border-box;
}

a {
  color: #034fa2;
}

.desktop {
  display: grid;
  min-height: 100vh;
  padding: 32px 16px;
  place-items: center;
}

.window {
  width: min(100%, 640px);
  border: 2px solid #0f3f9f;
  border-radius: 6px;
  background: #ece9d8;
  box-shadow: 6px 8px 0 rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 7px 10px;
  background: linear-gradient(180deg, #2f8cff, #0454c8);
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

h1 {
  margin: 0 0 6px;
  font-size: 1.75rem;
}

p {
  margin: 0;
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

input {
  width: 100%;
  border: 2px inset #fff;
  border-radius: 4px;
  padding: 10px;
  background: #fff;
  color: #161616;
}

button,
input {
  font: inherit;
}

button {
  justify-self: start;
  border: 1px solid #4b4b4b;
  border-radius: 4px;
  padding: 9px 16px;
  background: linear-gradient(180deg, #fffef6, #d7d2bc);
  color: #161616;
  font-weight: 700;
  cursor: pointer;
}

button:focus-visible,
input:focus-visible,
a:focus-visible {
  outline: 3px solid #f7d84a;
  outline-offset: 2px;
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

@media (max-width: 520px) {
  .desktop {
    align-items: start;
    padding: 16px 10px;
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
}`,
    '</style>',
    '</head>',
    '<body>',
    '<main class="desktop">',
    '<section class="window" aria-label="Release Notifier XP">',
    '<div class="title-bar">',
    '<span>Release Notifier XP</span>',
    '<span class="window-buttons" aria-hidden="true">',
    '<span class="window-button">_</span>',
    '<span class="window-button">x</span>',
    '</span>',
    '</div>',
    '<div class="window-body">',
    input.body,
    '</div>',
    '</section>',
    '</main>',
    '</body>',
    '</html>'
  ].join('')
}

function renderStatus (status: HomePageStatus | undefined): string {
  if (status === undefined) {
    return [
      '<div class="status" data-kind="idle" role="status">',
      '<strong>Status</strong>',
      '<span>Standing by for a repository and inbox.</span>',
      '</div>'
    ].join('')
  }

  return [
    `<div class="status" data-kind="${status.kind}" role="status">`,
    '<strong>Status</strong>',
    `<span>${escapeHtml(status.message)}</span>`,
    '</div>'
  ].join('')
}

export function renderHomePage (input: {
  status?: HomePageStatus
  values?: HomePageValues
}): string {
  const values = input.values ?? {}

  return renderPageShell({
    title: 'Release Notifier XP',
    body: [
      '<div class="masthead">',
      `<img class="brand-icon" src="${githubMarkUrl}" alt="GitHub mark">`,
      '<div>',
      '<h1>Release Notifier XP</h1>',
      '<p>Track a GitHub repo. Get a tiny electronic postcard when it ships.</p>',
      '</div>',
      '</div>',
      '<form action="/subscribe" method="post">',
      '<label for="repo">Repository</label>',
      `<input id="repo" name="repo" type="text" autocomplete="off" placeholder="nodejs/node" value="${escapeHtml(values.repo ?? '')}" required>`,
      '<label for="email">Email</label>',
      `<input id="email" name="email" type="email" autocomplete="email" placeholder="you@example.com" value="${escapeHtml(values.email ?? '')}" required>`,
      '<button type="submit">Start Watching</button>',
      '</form>',
      renderStatus(input.status)
    ].join('')
  })
}

export function renderTokenResultPage (input: {
  heading: string
  message: string
  state: TokenPageState
}): string {
  return renderPageShell({
    title: input.heading,
    body: [
      '<div class="masthead">',
      `<img class="brand-icon" src="${githubMarkUrl}" alt="GitHub mark">`,
      '<div>',
      `<h1>${escapeHtml(input.heading)}</h1>`,
      `<p>${escapeHtml(input.message)}</p>`,
      '</div>',
      '</div>',
      `<div class="status" data-kind="${input.state === 'success' ? 'success' : 'error'}" role="status">`,
      '<strong>Status</strong>',
      `<span>${input.state === 'success' ? 'All set.' : 'Needs attention.'}</span>`,
      '</div>',
      '<p class="token-actions"><a href="/">Back to Release Notifier XP</a></p>'
    ].join('')
  })
}
