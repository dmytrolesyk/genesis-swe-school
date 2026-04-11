import { describe, expect, it, vi } from 'vitest'

import type { GitHubClient } from '../github/client.ts'
import type { SubscriptionRepository } from './repository.ts'
import { createSubscriptionService } from './service.ts'
import {
  DuplicateSubscriptionError,
  GitHubRateLimitedError,
  GitHubRepositoryNotFoundError,
  InvalidTokenError,
  TokenNotFoundError
} from '../../shared/errors.ts'

function createResolvedVoidMock () {
  return vi.fn(() => Promise.resolve())
}

function createGitHubClientStub (): GitHubClient {
  return {
    assertRepositoryExists: createResolvedVoidMock(),
    getLatestReleaseTag: vi.fn(() => Promise.resolve(null))
  }
}

function createRepositoryMock (): SubscriptionRepository {
  return {
    confirmSubscription: createResolvedVoidMock(),
    ensureRepository: createResolvedVoidMock(),
    findActiveSubscription: vi.fn(() => Promise.resolve(null)),
    findByConfirmToken: vi.fn(() => Promise.resolve(null)),
    findByUnsubscribeToken: vi.fn(() => Promise.resolve(null)),
    getSubscriptionsByEmail: vi.fn(() => Promise.resolve([])),
    insertPendingSubscription: createResolvedVoidMock(),
    unsubscribe: createResolvedVoidMock()
  }
}

const validToken = '00000000-0000-4000-8000-000000000001'
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

describe('createSubscriptionService', () => {
  it('rejects duplicate active subscriptions', async () => {
    const repository = createRepositoryMock()
    repository.findActiveSubscription = vi.fn(() => Promise.resolve({
      id: 'existing-subscription'
    }))
    const githubClient = createGitHubClientStub()
    const service = createSubscriptionService({
      repository,
      githubClient,
      mailer: {
        sendConfirmationEmail: createResolvedVoidMock(),
        sendReleaseEmail: createResolvedVoidMock()
      },
      appBaseUrl: 'http://localhost:3000',
      generateToken: vi.fn(() => 'unused-token')
    })

    await expect(service.subscribe({
      email: 'user@example.com',
      repo: 'openai/openai-node'
    })).rejects.toBeInstanceOf(DuplicateSubscriptionError)
  })

  it('creates a pending subscription and sends a confirmation email', async () => {
    const repository = createRepositoryMock()
    const githubClient = createGitHubClientStub()
    const sendConfirmationEmail = createResolvedVoidMock()
    const generateToken = vi
      .fn<() => string>()
      .mockReturnValueOnce('subscription-id')
      .mockReturnValueOnce('confirm-token')
      .mockReturnValueOnce('unsubscribe-token')

    const service = createSubscriptionService({
      repository,
      githubClient,
      mailer: {
        sendConfirmationEmail,
        sendReleaseEmail: createResolvedVoidMock()
      },
      appBaseUrl: 'http://localhost:3000',
      generateToken
    })

    await service.subscribe({
      email: 'user@example.com',
      repo: ' openai/openai-node '
    })

    expect(githubClient.assertRepositoryExists).toHaveBeenCalledWith('openai/openai-node')
    expect(repository.findActiveSubscription).toHaveBeenCalledWith('user@example.com', 'openai/openai-node')
    expect(repository.ensureRepository).toHaveBeenCalledWith('openai/openai-node')
    expect(repository.insertPendingSubscription).toHaveBeenCalledWith({
      confirmToken: 'confirm-token',
      email: 'user@example.com',
      id: 'subscription-id',
      repoFullName: 'openai/openai-node',
      unsubscribeToken: 'unsubscribe-token'
    })
    expect(sendConfirmationEmail).toHaveBeenCalledWith({
      confirmUrl: 'http://localhost:3000/confirm/confirm-token',
      email: 'user@example.com',
      repoFullName: 'openai/openai-node',
      unsubscribeUrl: 'http://localhost:3000/unsubscribe/unsubscribe-token'
    })
  })

  it('surfaces GitHub not-found errors', async () => {
    const repository = createRepositoryMock()
    const githubClient = createGitHubClientStub()
    githubClient.assertRepositoryExists = vi.fn(() => Promise.reject(
      new GitHubRepositoryNotFoundError('openai/missing')
    ))
    const service = createSubscriptionService({
      repository,
      githubClient,
      mailer: {
        sendConfirmationEmail: createResolvedVoidMock(),
        sendReleaseEmail: createResolvedVoidMock()
      },
      appBaseUrl: 'http://localhost:3000',
      generateToken: vi.fn(() => 'unused-token')
    })

    await expect(service.subscribe({
      email: 'user@example.com',
      repo: 'openai/missing'
    })).rejects.toBeInstanceOf(GitHubRepositoryNotFoundError)
  })

  it('surfaces GitHub rate-limit errors', async () => {
    const repository = createRepositoryMock()
    const githubClient = createGitHubClientStub()
    githubClient.assertRepositoryExists = vi.fn(() => Promise.reject(new GitHubRateLimitedError()))
    const service = createSubscriptionService({
      repository,
      githubClient,
      mailer: {
        sendConfirmationEmail: createResolvedVoidMock(),
        sendReleaseEmail: createResolvedVoidMock()
      },
      appBaseUrl: 'http://localhost:3000',
      generateToken: vi.fn(() => 'unused-token')
    })

    await expect(service.subscribe({
      email: 'user@example.com',
      repo: 'openai/openai-node'
    })).rejects.toBeInstanceOf(GitHubRateLimitedError)
  })

  it('rejects invalid confirmation tokens before querying the repository', async () => {
    const repository = createRepositoryMock()
    const githubClient = createGitHubClientStub()
    const service = createSubscriptionService({
      repository,
      githubClient,
      mailer: {
        sendConfirmationEmail: createResolvedVoidMock(),
        sendReleaseEmail: createResolvedVoidMock()
      },
      appBaseUrl: 'http://localhost:3000'
    }) as ReturnType<typeof createSubscriptionService> & {
      confirmSubscription: (token: string) => Promise<void>
    }

    await expect(service.confirmSubscription('not-a-uuid')).rejects.toBeInstanceOf(
      InvalidTokenError
    )
    expect(repository.findByConfirmToken).not.toHaveBeenCalled()
  })

  it('returns 404 when the confirmation token is valid but missing', async () => {
    const repository = createRepositoryMock()
    const githubClient = createGitHubClientStub()
    const service = createSubscriptionService({
      repository,
      githubClient,
      mailer: {
        sendConfirmationEmail: createResolvedVoidMock(),
        sendReleaseEmail: createResolvedVoidMock()
      },
      appBaseUrl: 'http://localhost:3000'
    }) as ReturnType<typeof createSubscriptionService> & {
      confirmSubscription: (token: string) => Promise<void>
    }

    await expect(service.confirmSubscription(validToken)).rejects.toBeInstanceOf(
      TokenNotFoundError
    )
  })

  it('confirms a pending subscription', async () => {
    const repository = createRepositoryMock()
    repository.findByConfirmToken = vi.fn(() => Promise.resolve({
      confirmedAt: null,
      id: 'subscription-id'
    }))
    const githubClient = createGitHubClientStub()
    const service = createSubscriptionService({
      repository,
      githubClient,
      mailer: {
        sendConfirmationEmail: createResolvedVoidMock(),
        sendReleaseEmail: createResolvedVoidMock()
      },
      appBaseUrl: 'http://localhost:3000'
    }) as ReturnType<typeof createSubscriptionService> & {
      confirmSubscription: (token: string) => Promise<void>
    }

    await expect(service.confirmSubscription(validToken)).resolves.toBeUndefined()
    expect(repository.findByConfirmToken).toHaveBeenCalledWith(validToken)
    expect(repository.confirmSubscription).toHaveBeenCalledWith('subscription-id')
  })

  it('treats repeated confirmation of the same token as a no-op', async () => {
    const repository = createRepositoryMock()
    repository.findByConfirmToken = vi
      .fn()
      .mockResolvedValueOnce({
        confirmedAt: null,
        id: 'subscription-id'
      })
      .mockResolvedValueOnce({
        confirmedAt: new Date('2026-04-08T00:00:00.000Z'),
        id: 'subscription-id'
      })
    const githubClient = createGitHubClientStub()
    const service = createSubscriptionService({
      repository,
      githubClient,
      mailer: {
        sendConfirmationEmail: createResolvedVoidMock(),
        sendReleaseEmail: createResolvedVoidMock()
      },
      appBaseUrl: 'http://localhost:3000'
    }) as ReturnType<typeof createSubscriptionService> & {
      confirmSubscription: (token: string) => Promise<void>
    }

    await expect(service.confirmSubscription(validToken)).resolves.toBeUndefined()
    await expect(service.confirmSubscription(validToken)).resolves.toBeUndefined()
    expect(repository.confirmSubscription).toHaveBeenCalledTimes(1)
  })

  it('returns active subscriptions with confirmation and last_seen_tag metadata', async () => {
    const repository = {
      ...createRepositoryMock(),
      getSubscriptionsByEmail: vi.fn(() => Promise.resolve(listedSubscriptions))
    }
    const githubClient = createGitHubClientStub()
    const service = createSubscriptionService({
      repository,
      githubClient,
      mailer: {
        sendConfirmationEmail: createResolvedVoidMock(),
        sendReleaseEmail: createResolvedVoidMock()
      },
      appBaseUrl: 'http://localhost:3000'
    }) as ReturnType<typeof createSubscriptionService> & {
      getSubscriptionsByEmail: (email: string) => Promise<typeof listedSubscriptions>
    }

    await expect(service.getSubscriptionsByEmail('user@example.com')).resolves.toEqual(
      listedSubscriptions
    )
    expect(repository.getSubscriptionsByEmail).toHaveBeenCalledWith('user@example.com')
  })

  it('rejects invalid unsubscribe tokens before querying the repository', async () => {
    const repository = createRepositoryMock()
    const githubClient = createGitHubClientStub()
    const service = createSubscriptionService({
      repository,
      githubClient,
      mailer: {
        sendConfirmationEmail: createResolvedVoidMock(),
        sendReleaseEmail: createResolvedVoidMock()
      },
      appBaseUrl: 'http://localhost:3000'
    }) as ReturnType<typeof createSubscriptionService> & {
      unsubscribe: (token: string) => Promise<void>
    }

    await expect(
      Promise.resolve().then(async () => service.unsubscribe('not-a-uuid'))
    ).rejects.toBeInstanceOf(InvalidTokenError)
    expect(repository.findByUnsubscribeToken).not.toHaveBeenCalled()
  })

  it('returns 404 when the unsubscribe token is valid but missing', async () => {
    const repository = createRepositoryMock()
    const githubClient = createGitHubClientStub()
    const service = createSubscriptionService({
      repository,
      githubClient,
      mailer: {
        sendConfirmationEmail: createResolvedVoidMock(),
        sendReleaseEmail: createResolvedVoidMock()
      },
      appBaseUrl: 'http://localhost:3000'
    }) as ReturnType<typeof createSubscriptionService> & {
      unsubscribe: (token: string) => Promise<void>
    }

    await expect(
      Promise.resolve().then(async () => service.unsubscribe(validToken))
    ).rejects.toBeInstanceOf(TokenNotFoundError)
  })

  it('soft deletes an active subscription by unsubscribe token', async () => {
    const repository = createRepositoryMock()
    repository.findByUnsubscribeToken = vi.fn(() => Promise.resolve({
      id: 'subscription-id'
    }))
    const githubClient = createGitHubClientStub()
    const service = createSubscriptionService({
      repository,
      githubClient,
      mailer: {
        sendConfirmationEmail: createResolvedVoidMock(),
        sendReleaseEmail: createResolvedVoidMock()
      },
      appBaseUrl: 'http://localhost:3000'
    }) as ReturnType<typeof createSubscriptionService> & {
      unsubscribe: (token: string) => Promise<void>
    }

    await expect(
      Promise.resolve().then(async () => service.unsubscribe(validToken))
    ).resolves.toBeUndefined()
    expect(repository.findByUnsubscribeToken).toHaveBeenCalledWith(validToken)
    expect(repository.unsubscribe).toHaveBeenCalledWith('subscription-id')
  })
})
