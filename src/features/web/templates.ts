export type TokenPageState = 'success' | 'failure'

function escapeHtml (value: string): string {
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
}): string {
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
