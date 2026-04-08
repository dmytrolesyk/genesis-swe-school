import { describe, expect, it, vi } from 'vitest'

import {
  createGitHubClient,
  parseRepoRef
} from './client.ts'
import {
  GitHubRateLimitedError,
  GitHubRepositoryNotFoundError,
  InvalidRepoFormatError
} from '../../shared/errors.ts'

function createResponse (
  status: number,
  options: {
    body?: string
    headers?: Record<string, string>
  } = {}
) {
  return new Response(options.body ?? null, {
    headers: options.headers,
    status
  })
}

describe('parseRepoRef', () => {
  it('normalizes a valid owner/repo string', () => {
    expect(parseRepoRef(' openai/openai-node ')).toEqual({
      owner: 'openai',
      repo: 'openai-node',
      repoFullName: 'openai/openai-node'
    })
  })

  it.each([
    'openai',
    '/openai-node',
    'openai/',
    'openai/openai-node/releases'
  ])('rejects invalid repo format: %s', (repo) => {
    expect(() => parseRepoRef(repo)).toThrow(InvalidRepoFormatError)
  })
})

describe('createGitHubClient', () => {
  it('accepts repositories that exist', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(createResponse(200)))
    const client = createGitHubClient({
      fetch: fetchMock,
      token: 'secret-token'
    })

    await expect(client.assertRepositoryExists('openai/openai-node')).resolves.toBeUndefined()
    const [url, init] = fetchMock.mock.calls[0]

    expect(url).toBe('https://api.github.com/repos/openai/openai-node')
    expect(init).toMatchObject({
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer secret-token'
      }
    })
  })

  it('maps 404 responses to a typed repository-not-found error', async () => {
    const client = createGitHubClient({
      fetch: vi.fn<typeof fetch>(() => Promise.resolve(createResponse(404)))
    })

    await expect(client.assertRepositoryExists('openai/missing')).rejects.toBeInstanceOf(
      GitHubRepositoryNotFoundError
    )
  })

  it('maps 429 responses to a typed rate-limit error', async () => {
    const client = createGitHubClient({
      fetch: vi.fn<typeof fetch>(() => Promise.resolve(createResponse(429)))
    })

    await expect(client.assertRepositoryExists('openai/openai-node')).rejects.toBeInstanceOf(
      GitHubRateLimitedError
    )
  })

  it('returns the latest release tag when a release exists', async () => {
    const client = createGitHubClient({
      fetch: vi.fn<typeof fetch>(() => Promise.resolve(createResponse(200, {
        body: JSON.stringify({
          tag_name: 'v2.0.0'
        }),
        headers: {
          'content-type': 'application/json'
        }
      })))
    })

    await expect(client.getLatestReleaseTag('openai/openai-node')).resolves.toBe('v2.0.0')
  })

  it('returns null when the repository exists but has no releases yet', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(createResponse(404))
      .mockResolvedValueOnce(createResponse(200))
    const client = createGitHubClient({
      fetch: fetchMock
    })

    await expect(client.getLatestReleaseTag('openai/openai-node')).resolves.toBeNull()
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.github.com/repos/openai/openai-node/releases/latest',
      expect.any(Object)
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.github.com/repos/openai/openai-node',
      expect.any(Object)
    )
  })

  it('maps missing repositories during latest-release lookup to a typed error', async () => {
    const client = createGitHubClient({
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(createResponse(404))
        .mockResolvedValueOnce(createResponse(404))
    })

    await expect(client.getLatestReleaseTag('openai/missing')).rejects.toBeInstanceOf(
      GitHubRepositoryNotFoundError
    )
  })

  it('maps rate-limit responses during latest-release lookup to a typed error', async () => {
    const client = createGitHubClient({
      fetch: vi.fn<typeof fetch>(() => Promise.resolve(createResponse(429)))
    })

    await expect(client.getLatestReleaseTag('openai/openai-node')).rejects.toBeInstanceOf(
      GitHubRateLimitedError
    )
  })
})
