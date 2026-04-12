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

type Cache = {
  getJson: <T>(key: string) => Promise<T | null>
  setJson: (key: string, value: unknown, ttlSeconds: number) => Promise<void>
}

function createCacheStub () {
  const values = new Map<string, unknown>()
  const getJson = vi.fn<(key: string) => Promise<unknown>>((key) => {
    return Promise.resolve(values.get(key) ?? null)
  })
  const setJson = vi.fn((
    key: string,
    value: unknown,
    _ttlSeconds: number
  ) => {
    values.set(key, value)
    return Promise.resolve()
  })

  return {
    getJson,
    setJson,
    values,
    implementation: {
      async getJson<T> (key: string) {
        const value = await getJson(key)
        return value as T | null
      },
      async setJson (key: string, value: unknown, ttlSeconds: number) {
        await setJson(key, value, ttlSeconds)
      }
    } satisfies Cache
  }
}

function createGitHubMetricsMock () {
  return {
    githubCache: vi.fn(),
    githubRequest: vi.fn()
  }
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

  it('uses cached repository-exists results without fetching GitHub', async () => {
    const cache = createCacheStub()
    const metrics = createGitHubMetricsMock()
    cache.values.set('github:repo-exists:v1:openai/openai-node', {
      exists: true
    })
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(createResponse(200)))
    const client = createGitHubClient({
      cache: cache.implementation,
      cacheTtlSeconds: 600,
      fetch: fetchMock,
      metrics
    })

    await expect(client.assertRepositoryExists('openai/openai-node')).resolves.toBeUndefined()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(cache.getJson).toHaveBeenCalledWith(
      'github:repo-exists:v1:openai/openai-node'
    )
    expect(metrics.githubCache).toHaveBeenCalledWith('repo_exists', 'hit')
    expect(metrics.githubRequest).not.toHaveBeenCalled()
  })

  it('uses cached repository-not-found results without fetching GitHub', async () => {
    const cache = createCacheStub()
    cache.values.set('github:repo-exists:v1:openai/missing', {
      exists: false
    })
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(createResponse(200)))
    const client = createGitHubClient({
      cache: cache.implementation,
      cacheTtlSeconds: 600,
      fetch: fetchMock
    })

    await expect(client.assertRepositoryExists('openai/missing')).rejects.toBeInstanceOf(
      GitHubRepositoryNotFoundError
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('caches successful repository-exists lookups', async () => {
    const cache = createCacheStub()
    const metrics = createGitHubMetricsMock()
    const client = createGitHubClient({
      cache: cache.implementation,
      cacheTtlSeconds: 600,
      fetch: vi.fn<typeof fetch>(() => Promise.resolve(createResponse(200))),
      metrics
    })

    await expect(client.assertRepositoryExists('openai/openai-node')).resolves.toBeUndefined()

    expect(metrics.githubCache).toHaveBeenCalledWith('repo_exists', 'miss')
    expect(metrics.githubRequest).toHaveBeenCalledWith('repo_exists', 'success')
    expect(cache.setJson).toHaveBeenCalledWith(
      'github:repo-exists:v1:openai/openai-node',
      {
        exists: true
      },
      600
    )
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

  it('uses cached latest-release results without fetching GitHub', async () => {
    const cache = createCacheStub()
    const metrics = createGitHubMetricsMock()
    cache.values.set('github:latest-release:v1:openai/openai-node', {
      tag: 'v2.0.0'
    })
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(createResponse(200, {
      body: JSON.stringify({
        tag_name: 'v1.0.0'
      }),
      headers: {
        'content-type': 'application/json'
      }
    })))
    const client = createGitHubClient({
      cache: cache.implementation,
      cacheTtlSeconds: 600,
      fetch: fetchMock,
      metrics
    })

    await expect(client.getLatestReleaseTag('openai/openai-node')).resolves.toBe('v2.0.0')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(metrics.githubCache).toHaveBeenCalledWith('latest_release', 'hit')
    expect(metrics.githubRequest).not.toHaveBeenCalled()
  })

  it('uses cached no-release results without fetching GitHub', async () => {
    const cache = createCacheStub()
    cache.values.set('github:latest-release:v1:openai/openai-node', {
      tag: null
    })
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(createResponse(200, {
      body: JSON.stringify({
        tag_name: 'v1.0.0'
      }),
      headers: {
        'content-type': 'application/json'
      }
    })))
    const client = createGitHubClient({
      cache: cache.implementation,
      cacheTtlSeconds: 600,
      fetch: fetchMock
    })

    await expect(client.getLatestReleaseTag('openai/openai-node')).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to HTTP when cache reads fail', async () => {
    const cache = createCacheStub()
    cache.getJson.mockRejectedValue(new Error('redis down'))
    const client = createGitHubClient({
      cache: cache.implementation,
      cacheTtlSeconds: 600,
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

  it('does not fail GitHub operations when cache writes fail', async () => {
    const cache = createCacheStub()
    cache.setJson.mockRejectedValue(new Error('redis down'))
    const client = createGitHubClient({
      cache: cache.implementation,
      cacheTtlSeconds: 600,
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
    expect(cache.setJson).toHaveBeenCalledWith(
      'github:latest-release:v1:openai/openai-node',
      {
        tag: 'v2.0.0'
      },
      600
    )
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
