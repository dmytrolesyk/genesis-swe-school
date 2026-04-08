import closeWithGrace from 'close-with-grace'

import { buildApp } from './app.ts'
import { runMigrations } from './db/migrate.ts'

function readPort () {
  const port = Number.parseInt(process.env.PORT ?? '3000', 10)

  if (Number.isNaN(port)) {
    throw new TypeError('PORT must be a number')
  }

  return port
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

  await app.ready()
  await runMigrations({
    pool: app.pg
  })
  await app.listen({
    host: process.env.HOST ?? '0.0.0.0',
    port: readPort()
  })
}

await startServer()
