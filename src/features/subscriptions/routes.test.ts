import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildApp } from '../../app.ts'
import { GitHubRepositoryNotFoundError } from '../../shared/errors.ts'

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

function createRepositoryStub () {
  const activeSubscriptions = new Set<string>()
  const pendingSubscriptions: PendingSubscription[] = []

  return {
    state: {
      activeSubscriptions,
      pendingSubscriptions
    },
    implementation: {
      ensureRepository: createResolvedVoidMock(),
      findActiveSubscription: vi.fn((email: string, repoFullName: string) => {
        return activeSubscriptions.has(`${email}:${repoFullName}`)
          ? Promise.resolve({ id: `${email}:${repoFullName}` })
          : Promise.resolve(null)
      }),
      insertPendingSubscription: vi.fn((subscription: PendingSubscription) => {
        pendingSubscriptions.push(subscription)
        return Promise.resolve()
      })
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
