import {
  GitHubRateLimitedError,
  GitHubRepositoryNotFoundError
} from '../../shared/errors.ts'
import {
  nullCache,
  type Cache
} from '../../infra/cache/cache.ts'
import type { Metrics } from '../metrics/metrics.ts'
import { parseRepoRef } from './repo-ref.ts'

export { parseRepoRef } from './repo-ref.ts'

type FetchLike = typeof fetch

export type GitHubClient = {
  assertRepositoryExists: (repoFullName: string) => Promise<void>
  getLatestReleaseTag: (repoFullName: string) => Promise<string | null>
}

type CreateGitHubClientOptions = {
  cache?: Cache
  cacheTtlSeconds?: number
  fetch?: FetchLike
  metrics?: Pick<Metrics, 'githubCache' | 'githubRequest'>
  token?: string
}

type RepoExistsCacheValue = {
  exists: boolean
}

type LatestReleaseCacheValue = {
  tag: string | null
}

const defaultGitHubCacheTtlSeconds = 600

function createHeaders (token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json'
  }

  if (token !== undefined && token !== '') {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

function isRateLimitedResponse (response: Response) {
  return (
    response.status === 429 ||
    (
      response.status === 403 &&
      response.headers.get('x-ratelimit-remaining') === '0'
    )
  )
}

async function getCachedJson<T> (
  cache: Cache,
  key: string,
  metrics: Pick<Metrics, 'githubCache'> | undefined,
  operation: string
): Promise<T | null> {
  try {
    const value = await cache.getJson<T>(key)
    recordMetric(() => {
      metrics?.githubCache(operation, value === null ? 'miss' : 'hit')
    })

    return value
  } catch {
    recordMetric(() => {
      metrics?.githubCache(operation, 'error')
    })
    return null
  }
}

async function setCachedJson (
  cache: Cache,
  key: string,
  value: unknown,
  ttlSeconds: number,
  metrics: Pick<Metrics, 'githubCache'> | undefined,
  operation: string
): Promise<void> {
  try {
    await cache.setJson(key, value, ttlSeconds)
  } catch {
    recordMetric(() => {
      metrics?.githubCache(operation, 'write_error')
    })
  }
}

function recordMetric (record: () => void): void {
  try {
    record()
  } catch {}
}

function hasTagName (
  payload: unknown
): payload is {
  tag_name: string
} {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'tag_name' in payload &&
    typeof payload.tag_name === 'string' &&
    payload.tag_name !== ''
  )
}

export function createGitHubClient (
  options: CreateGitHubClientOptions = {}
): GitHubClient {
  const cache = options.cache ?? nullCache
  const cacheTtlSeconds = options.cacheTtlSeconds ?? defaultGitHubCacheTtlSeconds
  const fetchImplementation = options.fetch ?? globalThis.fetch
  const headers = createHeaders(options.token)
  const metrics = options.metrics

  async function assertRepositoryExists (repoFullName: string) {
    const parsedRepo = parseRepoRef(repoFullName)
    const cacheKey = `github:repo-exists:v1:${parsedRepo.repoFullName}`
    const cached = await getCachedJson<RepoExistsCacheValue>(
      cache,
      cacheKey,
      metrics,
      'repo_exists'
    )

    if (cached !== null) {
      if (cached.exists) {
        return
      }

      throw new GitHubRepositoryNotFoundError(parsedRepo.repoFullName)
    }

    const response = await fetchImplementation(
      `https://api.github.com/repos/${parsedRepo.repoFullName}`,
      {
        headers
      }
    )

    if (response.ok) {
      recordMetric(() => {
        metrics?.githubRequest('repo_exists', 'success')
      })
      await setCachedJson(cache, cacheKey, {
        exists: true
      }, cacheTtlSeconds, metrics, 'repo_exists')
      return
    }

    if (isRateLimitedResponse(response)) {
      recordMetric(() => {
        metrics?.githubRequest('repo_exists', 'rate_limited')
      })
      throw new GitHubRateLimitedError()
    }

    if (response.status === 404) {
      recordMetric(() => {
        metrics?.githubRequest('repo_exists', 'not_found')
      })
      await setCachedJson(cache, cacheKey, {
        exists: false
      }, cacheTtlSeconds, metrics, 'repo_exists')
      throw new GitHubRepositoryNotFoundError(parsedRepo.repoFullName)
    }

    recordMetric(() => {
      metrics?.githubRequest('repo_exists', 'error')
    })
    throw new Error(
      `GitHub repository lookup failed with status ${String(response.status)}`
    )
  }

  return {
    assertRepositoryExists,
    async getLatestReleaseTag (repoFullName: string) {
      const parsedRepo = parseRepoRef(repoFullName)
      const cacheKey = `github:latest-release:v1:${parsedRepo.repoFullName}`
      const cached = await getCachedJson<LatestReleaseCacheValue>(
        cache,
        cacheKey,
        metrics,
        'latest_release'
      )

      if (cached !== null) {
        return cached.tag
      }

      const response = await fetchImplementation(
        `https://api.github.com/repos/${parsedRepo.repoFullName}/releases/latest`,
        {
          headers
        }
      )

      if (response.ok) {
        const payload: unknown = await response.json()

        if (!hasTagName(payload)) {
          recordMetric(() => {
            metrics?.githubRequest('latest_release', 'invalid_response')
          })
          throw new Error('GitHub latest release response is missing tag_name')
        }

        recordMetric(() => {
          metrics?.githubRequest('latest_release', 'success')
        })
        await setCachedJson(cache, cacheKey, {
          tag: payload.tag_name
        }, cacheTtlSeconds, metrics, 'latest_release')

        return payload.tag_name
      }

      if (isRateLimitedResponse(response)) {
        recordMetric(() => {
          metrics?.githubRequest('latest_release', 'rate_limited')
        })
        throw new GitHubRateLimitedError()
      }

      if (response.status === 404) {
        recordMetric(() => {
          metrics?.githubRequest('latest_release', 'not_found')
        })
        await assertRepositoryExists(parsedRepo.repoFullName)
        await setCachedJson(cache, cacheKey, {
          tag: null
        }, cacheTtlSeconds, metrics, 'latest_release')
        return null
      }

      recordMetric(() => {
        metrics?.githubRequest('latest_release', 'error')
      })
      throw new Error(
        `GitHub latest release lookup failed with status ${String(response.status)}`
      )
    }
  }
}
