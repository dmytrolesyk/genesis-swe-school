import fp from 'fastify-plugin'
import {
  type FastifyPluginCallback,
  type FastifyPluginOptions
} from 'fastify'
import {
  type TypeBoxTypeProvider
} from '@fastify/type-provider-typebox'

import {
  createGitHubClient,
  type GitHubClient
} from '../github/client.ts'
import {
  createMailer,
  type Mailer
} from '../../infra/email/mailer.ts'
import {
  createSubscriptionRepository,
  type SubscriptionRepository
} from './repository.ts'
import {
  createSubscriptionService,
  type SubscriptionService
} from './service.ts'
import {
  confirmResponseSchema,
  subscriptionsResponseSchema,
  subscribeResponseSchema,
  unsubscribeResponseSchema
} from './schemas.ts'

export type SubscriptionRoutesOptions = FastifyPluginOptions & {
  githubClient?: GitHubClient
  mailer?: Mailer
  repository?: SubscriptionRepository
  service?: SubscriptionService
}

const subscriptionsRoutesPlugin: FastifyPluginCallback<SubscriptionRoutesOptions> = (
  fastify,
  options,
  done
) => {
  const githubClient = options.githubClient ?? createGitHubClient({
    cache: fastify.cache,
    cacheTtlSeconds: fastify.config.GITHUB_CACHE_TTL_SECONDS,
    token: fastify.config.GITHUB_TOKEN
  })
  const mailer = options.mailer ?? createMailer({
    from: fastify.config.SMTP_FROM,
    host: fastify.config.SMTP_HOST,
    pass: fastify.config.SMTP_PASS,
    port: fastify.config.SMTP_PORT,
    user: fastify.config.SMTP_USER
  })
  const repository = options.repository ?? createSubscriptionRepository(fastify.pg)
  const service = options.service ?? createSubscriptionService({
    appBaseUrl: fastify.config.APP_BASE_URL,
    githubClient,
    mailer,
    repository
  })
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>()

  app.post('/subscribe', {
    schema: subscribeResponseSchema
  }, async (request, reply) => {
    await service.subscribe(request.body)
    return reply.code(200).send({})
  })

  app.get('/confirm/:token', {
    schema: confirmResponseSchema
  }, async (request, reply) => {
    await service.confirmSubscription(request.params.token)
    return reply.code(200).send({})
  })

  app.get('/subscriptions', {
    schema: subscriptionsResponseSchema
  }, async (request, reply) => {
    const subscriptions = await service.getSubscriptionsByEmail(request.query.email)

    return reply.code(200).send(subscriptions)
  })

  app.get('/unsubscribe/:token', {
    schema: unsubscribeResponseSchema
  }, async (request, reply) => {
    await service.unsubscribe(request.params.token)
    return reply.code(200).send({})
  })

  done()
}

export default fp(subscriptionsRoutesPlugin, {
  name: 'subscriptions-routes',
  dependencies: ['cache', 'config', 'database', 'errors']
})
