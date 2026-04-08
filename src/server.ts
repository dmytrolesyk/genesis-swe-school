import closeWithGrace from 'close-with-grace'

import { buildApp } from './app.ts'

function readPort () {
  const port = Number.parseInt(process.env.PORT ?? '3000', 10)

  if (Number.isNaN(port)) {
    throw new TypeError('PORT must be a number')
  }

  return port
}

async function runStartupMigrations () {
  // Wired to the real migration runner in Task 2.
}

async function startServer () {
  const app = buildApp({
    logger: true
  })

  closeWithGrace({ delay: 500 }, async ({ err }) => {
    if (err !== undefined) {
      app.log.error({ err }, 'closing app after startup error')
    }

    await app.close()
  })

  await runStartupMigrations()
  await app.listen({
    host: process.env.HOST ?? '0.0.0.0',
    port: readPort()
  })
}

await startServer()
