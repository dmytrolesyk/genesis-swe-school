import Fastify, { type FastifyServerOptions } from 'fastify'

import configPlugin from './plugins/config.ts'
import databasePlugin from './plugins/database.ts'
import errorsPlugin from './plugins/errors.ts'

export function buildApp (options: FastifyServerOptions = {}) {
  const app = Fastify({
    logger: false,
    ...options
  })

  app.register(configPlugin)
  app.register(databasePlugin)
  app.register(errorsPlugin)

  return app
}
