import fp from 'fastify-plugin'
import type {
  FastifyPluginCallback,
  FastifyPluginOptions
} from 'fastify'

import { createGitHubClient } from '../github/client.ts'
import {
  createSubscriptionRepository
} from '../subscriptions/repository.ts'
import {
  createSubscriptionService,
  type SubscriptionService
} from '../subscriptions/service.ts'
import { createMailer } from '../../infra/email/mailer.ts'
import { AppError } from '../../shared/errors.ts'
import { renderTokenResultPage } from './templates.ts'

export type WebRoutesOptions = FastifyPluginOptions & {
  service?: SubscriptionService
}

type TokenParams = {
  token: string
}

function createDefaultSubscriptionService (
  fastify: Parameters<FastifyPluginCallback<WebRoutesOptions>>[0]
): SubscriptionService {
  return createSubscriptionService({
    appBaseUrl: fastify.config.APP_BASE_URL,
    githubClient: createGitHubClient({
      token: fastify.config.GITHUB_TOKEN
    }),
    mailer: createMailer({
      from: fastify.config.SMTP_FROM,
      host: fastify.config.SMTP_HOST,
      pass: fastify.config.SMTP_PASS,
      port: fastify.config.SMTP_PORT,
      user: fastify.config.SMTP_USER
    }),
    repository: createSubscriptionRepository(fastify.pg)
  })
}

function getErrorPageStatusCode (error: unknown): number {
  return error instanceof AppError ? error.statusCode : 500
}

function getErrorPageMessage (error: unknown, fallbackMessage: string): string {
  return error instanceof AppError ? error.message : fallbackMessage
}

const webRoutesPlugin: FastifyPluginCallback<WebRoutesOptions> = (
  fastify,
  options,
  done
) => {
  const service = options.service ?? createDefaultSubscriptionService(fastify)

  fastify.get('/confirm/:token', async (request, reply) => {
    const { token } = request.params as TokenParams

    try {
      await service.confirmSubscription(token)
      return await reply.type('text/html').send(renderTokenResultPage({
        heading: 'Subscription confirmed',
        message: 'You are now watching this repository.',
        state: 'success'
      }))
    } catch (error) {
      return reply
        .code(getErrorPageStatusCode(error))
        .type('text/html')
        .send(renderTokenResultPage({
          heading: 'Confirmation failed',
          message: getErrorPageMessage(error, 'Confirmation failed.'),
          state: 'failure'
        }))
    }
  })

  fastify.get('/unsubscribe/:token', async (request, reply) => {
    const { token } = request.params as TokenParams

    try {
      await service.unsubscribe(token)
      return await reply.type('text/html').send(renderTokenResultPage({
        heading: 'Unsubscribed',
        message: 'Release notifications have been turned off.',
        state: 'success'
      }))
    } catch (error) {
      return reply
        .code(getErrorPageStatusCode(error))
        .type('text/html')
        .send(renderTokenResultPage({
          heading: 'Unsubscribe failed',
          message: getErrorPageMessage(error, 'Unsubscribe failed.'),
          state: 'failure'
        }))
    }
  })

  done()
}

export default fp(webRoutesPlugin, {
  name: 'web-routes',
  dependencies: ['config', 'database', 'errors']
})
