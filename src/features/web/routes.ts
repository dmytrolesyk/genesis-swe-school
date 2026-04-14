import fp from 'fastify-plugin'
import type {
  FastifyReply,
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

export type WebRoutesOptions = FastifyPluginOptions & {
  service?: SubscriptionService
}

type TokenParams = {
  token: string
}

type SubscribeFormBody = {
  email: string
  repo: string
}

type SubscriptionsQuery = {
  email?: string
}

type HomePageStatus = {
  kind: 'error' | 'idle' | 'success'
  message: string
}

type HomePageValues = Partial<{
  email: string
  repo: string
}>

type TokenPageState = 'success' | 'failure'

type ViewData = Record<string, unknown> & {
  title: string
}

function readFormField (
  body: Record<string, unknown>,
  fieldName: keyof SubscribeFormBody
): string {
  const value = body[fieldName]

  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : ''
  }

  return typeof value === 'string' ? value : ''
}

function readSubscribeFormBody (body: unknown): SubscribeFormBody {
  if (typeof body !== 'object' || body === null) {
    return {
      email: '',
      repo: ''
    }
  }

  const formBody = body as Record<string, unknown>

  return {
    email: readFormField(formBody, 'email'),
    repo: readFormField(formBody, 'repo')
  }
}

function readEmailQuery (query: unknown): string | null {
  if (typeof query !== 'object' || query === null || !('email' in query)) {
    return null
  }

  const email = (query as SubscriptionsQuery).email

  if (typeof email !== 'string') {
    return null
  }

  return email
}

function isEmailLike (email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function createDefaultSubscriptionService (
  fastify: Parameters<FastifyPluginCallback<WebRoutesOptions>>[0]
): SubscriptionService {
  return createSubscriptionService({
    appBaseUrl: fastify.config.APP_BASE_URL,
    githubClient: createGitHubClient({
      cache: fastify.cache,
      cacheTtlSeconds: fastify.config.GITHUB_CACHE_TTL_SECONDS,
      metrics: fastify.metrics,
      token: fastify.config.GITHUB_TOKEN
    }),
    mailer: createMailer({
      from: fastify.config.SMTP_FROM,
      host: fastify.config.SMTP_HOST,
      pass: fastify.config.SMTP_PASS,
      port: fastify.config.SMTP_PORT,
      user: fastify.config.SMTP_USER
    }),
    metrics: fastify.metrics,
    repository: createSubscriptionRepository(fastify.pg)
  })
}

function getErrorPageStatusCode (error: unknown): number {
  return error instanceof AppError ? error.statusCode : 500
}

function getErrorPageMessage (error: unknown, fallbackMessage: string): string {
  return error instanceof AppError ? error.message : fallbackMessage
}

async function renderLayout (
  reply: FastifyReply,
  template: string,
  data: ViewData
) {
  const body = await reply.viewAsync(template, data)

  return await reply
    .type('text/html')
    .viewAsync('layout.ejs', {
      body,
      title: data.title
    })
}

async function renderHome (
  reply: FastifyReply,
  input: {
    status: HomePageStatus
    values: HomePageValues
  }
) {
  return await renderLayout(reply, 'home.ejs', {
    status: input.status,
    title: 'Release Notifier XP',
    values: input.values
  })
}

async function renderTokenResult (
  reply: FastifyReply,
  input: {
    heading: string
    message: string
    state: TokenPageState
  }
) {
  return await renderLayout(reply, 'token-result.ejs', {
    heading: input.heading,
    message: input.message,
    state: input.state,
    title: input.heading
  })
}

const webRoutesPlugin: FastifyPluginCallback<WebRoutesOptions> = (
  fastify,
  options,
  done
) => {
  const service = options.service ?? createDefaultSubscriptionService(fastify)

  fastify.get('/', async (_request, reply) => {
    return await renderHome(reply, {
      status: {
        kind: 'idle',
        message: 'Standing by for a repository and inbox.'
      },
      values: {}
    })
  })

  fastify.get('/subscriptions', async (request, reply) => {
    const email = readEmailQuery(request.query)

    if (email === null || !isEmailLike(email)) {
      return await reply.code(400).send({
        error: 'BAD_REQUEST',
        message: 'A valid email query is required',
        statusCode: 400
      })
    }

    const subscriptions = await service.getSubscriptionsByEmail(email)
    const confirmedSubscriptions = subscriptions.filter((subscription) => {
      return subscription.confirmed
    })

    return await reply.code(200).send(confirmedSubscriptions)
  })

  fastify.post('/subscribe', async (request, reply) => {
    const body = readSubscribeFormBody(request.body)

    try {
      await service.subscribe({
        email: body.email,
        repo: body.repo
      })

      return await renderHome(reply, {
        status: {
          kind: 'success',
          message: 'Inbox armed. Check your email to confirm the subscription.'
        },
        values: body
      })
    } catch (error) {
      const message = getErrorPageMessage(
        error,
        'Something went sideways while dialing GitHub.'
      )

      return reply
        .code(getErrorPageStatusCode(error))
        .type('text/html')
        .send(await renderHome(reply, {
          status: {
            kind: 'error',
            message
          },
          values: body
        }))
    }
  })

  fastify.get('/confirm/:token', async (request, reply) => {
    const { token } = request.params as TokenParams

    try {
      await service.confirmSubscription(token)
      return await renderTokenResult(reply, {
        heading: 'Subscription confirmed',
        message: 'You are now watching this repository.',
        state: 'success'
      })
    } catch (error) {
      return reply
        .code(getErrorPageStatusCode(error))
        .type('text/html')
        .send(await renderTokenResult(reply, {
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
      return await renderTokenResult(reply, {
        heading: 'Unsubscribed',
        message: 'Release notifications have been turned off.',
        state: 'success'
      })
    } catch (error) {
      return reply
        .code(getErrorPageStatusCode(error))
        .type('text/html')
        .send(await renderTokenResult(reply, {
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
  dependencies: ['cache', 'config', 'database', 'errors', 'metrics']
})
