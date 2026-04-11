import Fastify, { type FastifyServerOptions } from 'fastify'

import releaseScheduler, {
  type ReleaseSchedulerOptions
} from './features/releases/scheduler.ts'
import subscriptionsRoutes, {
  type SubscriptionRoutesOptions
} from './features/subscriptions/routes.ts'
import webRoutes, {
  type WebRoutesOptions
} from './features/web/routes.ts'
import apiKeyAuthPlugin from './plugins/api-key-auth.ts'
import configPlugin from './plugins/config.ts'
import databasePlugin from './plugins/database.ts'
import errorsPlugin from './plugins/errors.ts'

type BuildAppFeatureOptions = {
  releases?: ReleaseSchedulerOptions
  subscriptions?: SubscriptionRoutesOptions
  web?: WebRoutesOptions
}

export function buildApp (
  options: FastifyServerOptions = {},
  featureOptions: BuildAppFeatureOptions = {}
) {
  const app = Fastify({
    logger: false,
    ...options
  })

  app.register(configPlugin)
  app.register(databasePlugin)
  app.register(errorsPlugin)
  app.register(webRoutes, featureOptions.web ?? {})
  app.register(async function apiRoutes (api) {
    await api.register(apiKeyAuthPlugin)
    await api.register(subscriptionsRoutes, featureOptions.subscriptions ?? {})
  }, {
    prefix: '/api'
  })
  app.register(releaseScheduler, featureOptions.releases ?? {})

  return app
}
