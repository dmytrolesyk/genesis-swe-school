import { describe, expect, it, vi } from 'vitest'

import { createSubscriptionService } from './service.ts'
import {
  DuplicateSubscriptionError,
  GitHubRateLimitedError,
  GitHubRepositoryNotFoundError
} from '../../shared/errors.ts'

function createResolvedVoidMock () {
  return vi.fn(() => Promise.resolve())
}

describe('createSubscriptionService', () => {
  it('rejects duplicate active subscriptions', async () => {
    const service = createSubscriptionService({
      repository: {
        ensureRepository: createResolvedVoidMock(),
        findActiveSubscription: vi.fn(() => Promise.resolve({ id: 'existing-subscription' })),
        insertPendingSubscription: createResolvedVoidMock()
      },
      githubClient: {
        assertRepositoryExists: createResolvedVoidMock()
      },
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
    const ensureRepository = createResolvedVoidMock()
    const findActiveSubscription = vi.fn(() => Promise.resolve(null))
    const insertPendingSubscription = createResolvedVoidMock()
    const assertRepositoryExists = createResolvedVoidMock()
    const sendConfirmationEmail = createResolvedVoidMock()
    const generateToken = vi
      .fn<() => string>()
      .mockReturnValueOnce('subscription-id')
      .mockReturnValueOnce('confirm-token')
      .mockReturnValueOnce('unsubscribe-token')

    const service = createSubscriptionService({
      repository: {
        ensureRepository,
        findActiveSubscription,
        insertPendingSubscription
      },
      githubClient: {
        assertRepositoryExists
      },
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

    expect(assertRepositoryExists).toHaveBeenCalledWith('openai/openai-node')
    expect(findActiveSubscription).toHaveBeenCalledWith('user@example.com', 'openai/openai-node')
    expect(ensureRepository).toHaveBeenCalledWith('openai/openai-node')
    expect(insertPendingSubscription).toHaveBeenCalledWith({
      confirmToken: 'confirm-token',
      email: 'user@example.com',
      id: 'subscription-id',
      repoFullName: 'openai/openai-node',
      unsubscribeToken: 'unsubscribe-token'
    })
    expect(sendConfirmationEmail).toHaveBeenCalledWith({
      confirmUrl: 'http://localhost:3000/api/confirm/confirm-token',
      email: 'user@example.com',
      repoFullName: 'openai/openai-node',
      unsubscribeUrl: 'http://localhost:3000/api/unsubscribe/unsubscribe-token'
    })
  })

  it('surfaces GitHub not-found errors', async () => {
    const service = createSubscriptionService({
      repository: {
        ensureRepository: createResolvedVoidMock(),
        findActiveSubscription: vi.fn(() => Promise.resolve(null)),
        insertPendingSubscription: createResolvedVoidMock()
      },
      githubClient: {
        assertRepositoryExists: vi.fn(() => Promise.reject(
          new GitHubRepositoryNotFoundError('openai/missing')
        ))
      },
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
    const service = createSubscriptionService({
      repository: {
        ensureRepository: createResolvedVoidMock(),
        findActiveSubscription: vi.fn(() => Promise.resolve(null)),
        insertPendingSubscription: createResolvedVoidMock()
      },
      githubClient: {
        assertRepositoryExists: vi.fn(() => Promise.reject(new GitHubRateLimitedError()))
      },
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
})
