import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildApp } from '../../app.ts'
import type { SubscriptionService } from './service.ts'
import {
  GitHubRepositoryNotFoundError,
  TokenNotFoundError
} from '../../shared/errors.ts'

type PendingSubscription = {
  confirmToken: string
  email: string
  id: string
  repoFullName: string
  unsubscribeToken: string
}

function createResolvedVoidMock () {
  return vi.fn(() => Promise.resolve())
}

function createServiceStub (): SubscriptionService {
  return {
    confirmSubscription: createResolvedVoidMock(),
    getSubscriptionsByEmail: vi.fn(() => Promise.resolve([])),
    subscribe: createResolvedVoidMock(),
    unsubscribe: createResolvedVoidMock()
  }
}

const validToken = '00000000-0000-4000-8000-000000000001'
const secondValidToken = '00000000-0000-4000-8000-000000000002'
const listedSubscriptions = [
  {
    confirmed: true,
    email: 'user@example.com',
    last_seen_tag: 'v1.0.0',
    repo: 'openai/openai-node'
  },
  {
    confirmed: false,
    email: 'user@example.com',
    last_seen_tag: null,
    repo: 'openai/openai-agents-js'
  }
]

function createRepositoryStub () {
  const activeSubscriptions = new Set<string>()
  const pendingSubscriptions: PendingSubscription[] = []

  return {
    state: {
      activeSubscriptions,
      pendingSubscriptions
    },
    implementation: {
      confirmSubscription: createResolvedVoidMock(),
      ensureRepository: createResolvedVoidMock(),
      findActiveSubscription: vi.fn((email: string, repoFullName: string) => {
        return activeSubscriptions.has(`${email}:${repoFullName}`)
          ? Promise.resolve({ id: `${email}:${repoFullName}` })
          : Promise.resolve(null)
      }),
      findByConfirmToken: vi.fn(() => Promise.resolve(null)),
      findByUnsubscribeToken: vi.fn(() => Promise.resolve(null)),
      getSubscriptionsByEmail: vi.fn(() => Promise.resolve([])),
      insertPendingSubscription: vi.fn((subscription: PendingSubscription) => {
        pendingSubscriptions.push(subscription)
        return Promise.resolve()
      }),
      unsubscribe: createResolvedVoidMock()
    }
  }
}

describe('POST /api/subscribe', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 400 for invalid request bodies', async () => {
    const app = buildApp({}, {
      subscriptions: {
        githubClient: {
          assertRepositoryExists: createResolvedVoidMock()
        },
        mailer: {
          sendConfirmationEmail: createResolvedVoidMock(),
          sendReleaseEmail: createResolvedVoidMock()
        },
        repository: createRepositoryStub().implementation
      }
    })

    await app.ready()

    const response = await app.inject({
      method: 'POST',
      payload: {
        email: 'user@example.com'
      },
      url: '/api/subscribe'
    })

    expect(response.statusCode).toBe(400)

    await app.close()
  })

  it('returns 400 for invalid repo format', async () => {
    const repository = createRepositoryStub()
    const app = buildApp({}, {
      subscriptions: {
        githubClient: {
          assertRepositoryExists: createResolvedVoidMock()
        },
        mailer: {
          sendConfirmationEmail: createResolvedVoidMock(),
          sendReleaseEmail: createResolvedVoidMock()
        },
        repository: repository.implementation
      }
    })

    await app.ready()

    const response = await app.inject({
      method: 'POST',
      payload: {
        email: 'user@example.com',
        repo: 'openai'
      },
      url: '/api/subscribe'
    })

    expect(response.statusCode).toBe(400)
    expect(repository.state.pendingSubscriptions).toHaveLength(0)

    await app.close()
  })

  it('returns 404 when GitHub reports the repository is missing', async () => {
    const repository = createRepositoryStub()
    const app = buildApp({}, {
      subscriptions: {
        githubClient: {
          assertRepositoryExists: vi.fn(() => Promise.reject(
            new GitHubRepositoryNotFoundError('openai/missing')
          ))
        },
        mailer: {
          sendConfirmationEmail: createResolvedVoidMock(),
          sendReleaseEmail: createResolvedVoidMock()
        },
        repository: repository.implementation
      }
    })

    await app.ready()

    const response = await app.inject({
      method: 'POST',
      payload: {
        email: 'user@example.com',
        repo: 'openai/missing'
      },
      url: '/api/subscribe'
    })

    expect(response.statusCode).toBe(404)

    await app.close()
  })

  it('returns 409 for duplicate subscriptions', async () => {
    const repository = createRepositoryStub()
    repository.state.activeSubscriptions.add('user@example.com:openai/openai-node')

    const app = buildApp({}, {
      subscriptions: {
        githubClient: {
          assertRepositoryExists: createResolvedVoidMock()
        },
        mailer: {
          sendConfirmationEmail: createResolvedVoidMock(),
          sendReleaseEmail: createResolvedVoidMock()
        },
        repository: repository.implementation
      }
    })

    await app.ready()

    const response = await app.inject({
      method: 'POST',
      payload: {
        email: 'user@example.com',
        repo: 'openai/openai-node'
      },
      url: '/api/subscribe'
    })

    expect(response.statusCode).toBe(409)

    await app.close()
  })

  it('returns 200 for successful subscriptions', async () => {
    const repository = createRepositoryStub()
    const sendConfirmationEmail = createResolvedVoidMock()
    const app = buildApp({}, {
      subscriptions: {
        githubClient: {
          assertRepositoryExists: createResolvedVoidMock()
        },
        mailer: {
          sendConfirmationEmail,
          sendReleaseEmail: createResolvedVoidMock()
        },
        repository: repository.implementation
      }
    })

    await app.ready()

    const response = await app.inject({
      method: 'POST',
      payload: {
        email: 'user@example.com',
        repo: 'openai/openai-node'
      },
      url: '/api/subscribe'
    })

    expect(response.statusCode).toBe(200)
    expect(repository.state.pendingSubscriptions).toHaveLength(1)
    expect(sendConfirmationEmail).toHaveBeenCalledTimes(1)

    await app.close()
  })
})

describe('GET /api/confirm/:token', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 400 for invalid token shapes', async () => {
    const service = createServiceStub()
    const app = buildApp({}, {
      subscriptions: {
        service
      }
    })

    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: '/api/confirm/not-a-uuid'
    })

    expect(response.statusCode).toBe(400)
    expect(service.confirmSubscription).not.toHaveBeenCalled()

    await app.close()
  })

  it('returns 404 for unknown confirmation tokens', async () => {
    const service = createServiceStub()
    service.confirmSubscription = vi.fn(() => Promise.reject(new TokenNotFoundError()))
    const app = buildApp({}, {
      subscriptions: {
        service
      }
    })

    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: `/api/confirm/${validToken}`
    })

    expect(response.statusCode).toBe(404)

    await app.close()
  })

  it('returns 200 when a subscription is confirmed', async () => {
    const service = createServiceStub()
    const app = buildApp({}, {
      subscriptions: {
        service
      }
    })

    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: `/api/confirm/${validToken}`
    })

    expect(response.statusCode).toBe(200)
    expect(service.confirmSubscription).toHaveBeenCalledWith(validToken)

    await app.close()
  })

  it('keeps repeated confirmation predictable', async () => {
    const service = createServiceStub()
    const app = buildApp({}, {
      subscriptions: {
        service
      }
    })

    await app.ready()

    const firstResponse = await app.inject({
      method: 'GET',
      url: `/api/confirm/${validToken}`
    })
    const secondResponse = await app.inject({
      method: 'GET',
      url: `/api/confirm/${validToken}`
    })

    expect(firstResponse.statusCode).toBe(200)
    expect(secondResponse.statusCode).toBe(200)
    expect(service.confirmSubscription).toHaveBeenCalledTimes(2)

    await app.close()
  })
})

describe('GET /api/subscriptions', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 400 for invalid email queries', async () => {
    const service = createServiceStub()
    const app = buildApp({}, {
      subscriptions: {
        service
      }
    })

    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: '/api/subscriptions?email=not-an-email'
    })

    expect(response.statusCode).toBe(400)
    expect(service.getSubscriptionsByEmail).not.toHaveBeenCalled()

    await app.close()
  })

  it('returns active subscriptions with confirmed and last_seen_tag fields', async () => {
    const service = createServiceStub()
    service.getSubscriptionsByEmail = vi.fn(() => Promise.resolve(listedSubscriptions))
    const app = buildApp({}, {
      subscriptions: {
        service
      }
    })

    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: '/api/subscriptions?email=user@example.com'
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(listedSubscriptions)
    expect(service.getSubscriptionsByEmail).toHaveBeenCalledWith('user@example.com')

    await app.close()
  })
})

describe('GET /api/unsubscribe/:token', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 400 for invalid token shapes', async () => {
    const service = createServiceStub()
    const app = buildApp({}, {
      subscriptions: {
        service
      }
    })

    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: '/api/unsubscribe/not-a-uuid'
    })

    expect(response.statusCode).toBe(400)
    expect(service.unsubscribe).not.toHaveBeenCalled()

    await app.close()
  })

  it('returns 404 for unknown unsubscribe tokens', async () => {
    const service = createServiceStub()
    service.unsubscribe = vi.fn(() => Promise.reject(new TokenNotFoundError()))
    const app = buildApp({}, {
      subscriptions: {
        service
      }
    })

    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: `/api/unsubscribe/${validToken}`
    })

    expect(response.statusCode).toBe(404)

    await app.close()
  })

  it('returns 200 when a subscription is unsubscribed', async () => {
    const service = createServiceStub()
    const app = buildApp({}, {
      subscriptions: {
        service
      }
    })

    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: `/api/unsubscribe/${validToken}`
    })

    expect(response.statusCode).toBe(200)
    expect(service.unsubscribe).toHaveBeenCalledWith(validToken)

    await app.close()
  })

  it('removes unsubscribed records from subscription lookups', async () => {
    const subscriptions = [
      {
        confirmed: true,
        email: 'user@example.com',
        last_seen_tag: 'v1.0.0',
        repo: 'openai/openai-node',
        token: secondValidToken
      }
    ]
    const service = createServiceStub() as SubscriptionService & {
      unsubscribe: (token: string) => Promise<void>
    }

    service.unsubscribe = vi.fn((token: string) => {
      const subscriptionIndex = subscriptions.findIndex((subscription) => {
        return subscription.token === token
      })

      if (subscriptionIndex === -1) {
        throw new TokenNotFoundError()
      }

      subscriptions.splice(subscriptionIndex, 1)
      return Promise.resolve()
    })
    service.getSubscriptionsByEmail = vi.fn((email: string) => {
      return Promise.resolve(
        subscriptions
          .filter((subscription) => subscription.email === email)
          .map(({ token: _token, ...subscription }) => subscription)
      )
    })

    const app = buildApp({}, {
      subscriptions: {
        service
      }
    })

    await app.ready()

    const unsubscribeResponse = await app.inject({
      method: 'GET',
      url: `/api/unsubscribe/${secondValidToken}`
    })
    const subscriptionsResponse = await app.inject({
      method: 'GET',
      url: '/api/subscriptions?email=user@example.com'
    })

    expect(unsubscribeResponse.statusCode).toBe(200)
    expect(subscriptionsResponse.statusCode).toBe(200)
    expect(subscriptionsResponse.json()).toEqual([])

    await app.close()
  })
})
