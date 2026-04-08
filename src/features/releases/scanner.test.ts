import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GitHubClient } from '../github/client.ts'
import type { Mailer } from '../../infra/email/mailer.ts'
import { GitHubRateLimitedError } from '../../shared/errors.ts'
import type {
  ReleaseRepository,
  ReleaseSubscriber
} from './repository.ts'
import { createReleaseScanner } from './scanner.ts'
import { createReleaseScheduler } from './scheduler.ts'

function createResolvedVoidMock () {
  return vi.fn(() => Promise.resolve())
}

function createReleaseRepositoryMock (): ReleaseRepository {
  return {
    getLastSeenTag: vi.fn(() => Promise.resolve(null)),
    listConfirmedSubscribers: vi.fn(() => Promise.resolve([])),
    listSubscribedRepositories: vi.fn(() => Promise.resolve([])),
    updateLastSeenTag: createResolvedVoidMock()
  }
}

function createGitHubClientMock (): Pick<GitHubClient, 'getLatestReleaseTag'> {
  return {
    getLatestReleaseTag: vi.fn(() => Promise.resolve(null))
  }
}

function createMailerMock (): Pick<Mailer, 'sendReleaseEmail'> {
  return {
    sendReleaseEmail: createResolvedVoidMock()
  }
}

describe('createReleaseScanner', () => {
  it('stores the first seen tag as a baseline without sending emails', async () => {
    const repository = createReleaseRepositoryMock()
    repository.listSubscribedRepositories = vi.fn(() => Promise.resolve([
      'openai/openai-node'
    ]))
    const githubClient = createGitHubClientMock()
    githubClient.getLatestReleaseTag = vi.fn(() => Promise.resolve('v1.0.0'))
    const mailer = createMailerMock()

    const scanner = createReleaseScanner({
      appBaseUrl: 'http://localhost:3000',
      githubClient,
      mailer,
      repository
    })

    await scanner.scanAllRepositories()

    expect(repository.updateLastSeenTag).toHaveBeenCalledWith('openai/openai-node', 'v1.0.0')
    expect(repository.listConfirmedSubscribers).not.toHaveBeenCalled()
    expect(mailer.sendReleaseEmail).not.toHaveBeenCalled()
  })

  it('does not send emails when the release tag is unchanged', async () => {
    const repository = createReleaseRepositoryMock()
    repository.listSubscribedRepositories = vi.fn(() => Promise.resolve([
      'openai/openai-node'
    ]))
    repository.getLastSeenTag = vi.fn(() => Promise.resolve('v1.0.0'))
    const githubClient = createGitHubClientMock()
    githubClient.getLatestReleaseTag = vi.fn(() => Promise.resolve('v1.0.0'))
    const mailer = createMailerMock()

    const scanner = createReleaseScanner({
      appBaseUrl: 'http://localhost:3000',
      githubClient,
      mailer,
      repository
    })

    await scanner.scanAllRepositories()

    expect(repository.updateLastSeenTag).not.toHaveBeenCalled()
    expect(repository.listConfirmedSubscribers).not.toHaveBeenCalled()
    expect(mailer.sendReleaseEmail).not.toHaveBeenCalled()
  })

  it('updates the stored tag and notifies confirmed active subscribers when a new release appears', async () => {
    const repository = createReleaseRepositoryMock()
    const subscribers: ReleaseSubscriber[] = [
      {
        email: 'first@example.com',
        unsubscribeToken: 'unsubscribe-token-1'
      },
      {
        email: 'second@example.com',
        unsubscribeToken: 'unsubscribe-token-2'
      }
    ]

    repository.listSubscribedRepositories = vi.fn(() => Promise.resolve([
      'openai/openai-node'
    ]))
    repository.getLastSeenTag = vi.fn(() => Promise.resolve('v1.0.0'))
    repository.listConfirmedSubscribers = vi.fn(() => Promise.resolve(subscribers))

    const githubClient = createGitHubClientMock()
    githubClient.getLatestReleaseTag = vi.fn(() => Promise.resolve('v2.0.0'))
    const mailer = createMailerMock()

    const scanner = createReleaseScanner({
      appBaseUrl: 'http://localhost:3000',
      githubClient,
      mailer,
      repository
    })

    await scanner.scanAllRepositories()

    expect(mailer.sendReleaseEmail).toHaveBeenCalledTimes(2)
    expect(mailer.sendReleaseEmail).toHaveBeenNthCalledWith(1, {
      email: 'first@example.com',
      repoFullName: 'openai/openai-node',
      tag: 'v2.0.0',
      unsubscribeUrl: 'http://localhost:3000/api/unsubscribe/unsubscribe-token-1'
    })
    expect(mailer.sendReleaseEmail).toHaveBeenNthCalledWith(2, {
      email: 'second@example.com',
      repoFullName: 'openai/openai-node',
      tag: 'v2.0.0',
      unsubscribeUrl: 'http://localhost:3000/api/unsubscribe/unsubscribe-token-2'
    })
    expect(repository.updateLastSeenTag).toHaveBeenCalledWith('openai/openai-node', 'v2.0.0')
  })

  it('keeps scanning when a repository has no releases yet', async () => {
    const repository = createReleaseRepositoryMock()
    repository.listSubscribedRepositories = vi.fn(() => Promise.resolve([
      'openai/openai-node',
      'openai/openai-agents-js'
    ]))
    repository.getLastSeenTag = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    const githubClient = createGitHubClientMock()
    githubClient.getLatestReleaseTag = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('v1.2.0')
    const mailer = createMailerMock()

    const scanner = createReleaseScanner({
      appBaseUrl: 'http://localhost:3000',
      githubClient,
      mailer,
      repository
    })

    await scanner.scanAllRepositories()

    expect(repository.updateLastSeenTag).toHaveBeenCalledTimes(1)
    expect(repository.updateLastSeenTag).toHaveBeenCalledWith(
      'openai/openai-agents-js',
      'v1.2.0'
    )
    expect(mailer.sendReleaseEmail).not.toHaveBeenCalled()
  })

  it('keeps scanning other repositories when GitHub rate limits one lookup', async () => {
    const repository = createReleaseRepositoryMock()
    repository.listSubscribedRepositories = vi.fn(() => Promise.resolve([
      'openai/openai-node',
      'openai/openai-agents-js'
    ]))
    repository.getLastSeenTag = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    const githubClient = createGitHubClientMock()
    githubClient.getLatestReleaseTag = vi
      .fn()
      .mockRejectedValueOnce(new GitHubRateLimitedError())
      .mockResolvedValueOnce('v3.0.0')
    const mailer = createMailerMock()

    const scanner = createReleaseScanner({
      appBaseUrl: 'http://localhost:3000',
      githubClient,
      mailer,
      repository
    })

    await scanner.scanAllRepositories()

    expect(repository.updateLastSeenTag).toHaveBeenCalledTimes(1)
    expect(repository.updateLastSeenTag).toHaveBeenCalledWith(
      'openai/openai-agents-js',
      'v3.0.0'
    )
    expect(mailer.sendReleaseEmail).not.toHaveBeenCalled()
  })
})

describe('createReleaseScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('prevents overlapping scan runs and stops cleanly', async () => {
    let finishRun: (() => void) | undefined
    const scanner = {
      scanAllRepositories: vi.fn(() => {
        return new Promise<void>((resolve) => {
          finishRun = resolve
        })
      })
    }

    const scheduler = createReleaseScheduler({
      intervalMs: 1000,
      scanner
    })

    scheduler.start()

    await vi.advanceTimersByTimeAsync(1000)
    expect(scanner.scanAllRepositories).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1000)
    expect(scanner.scanAllRepositories).toHaveBeenCalledTimes(1)

    finishRun?.()
    await Promise.resolve()

    await vi.advanceTimersByTimeAsync(1000)
    expect(scanner.scanAllRepositories).toHaveBeenCalledTimes(2)

    scheduler.stop()
    await vi.advanceTimersByTimeAsync(1000)
    expect(scanner.scanAllRepositories).toHaveBeenCalledTimes(2)
  })
})
