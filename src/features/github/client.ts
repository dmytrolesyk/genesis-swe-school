import {
  GitHubRateLimitedError,
  GitHubRepositoryNotFoundError
} from '../../shared/errors.ts'
import {
  nullCache,
  type Cache
} from '../../infra/cache/cache.ts'
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
  key: string
): Promise<T | null> {
  try {
    return await cache.getJson<T>(key)
  } catch {
    return null
  }
}

async function setCachedJson (
  cache: Cache,
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  try {
    await cache.setJson(key, value, ttlSeconds)
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

  async function assertRepositoryExists (repoFullName: string) {
    const parsedRepo = parseRepoRef(repoFullName)
    const cacheKey = `github:repo-exists:v1:${parsedRepo.repoFullName}`
    const cached = await getCachedJson<RepoExistsCacheValue>(cache, cacheKey)

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
      await setCachedJson(cache, cacheKey, {
        exists: true
      }, cacheTtlSeconds)
      return
    }

    if (isRateLimitedResponse(response)) {
      throw new GitHubRateLimitedError()
    }

    if (response.status === 404) {
      await setCachedJson(cache, cacheKey, {
        exists: false
      }, cacheTtlSeconds)
      throw new GitHubRepositoryNotFoundError(parsedRepo.repoFullName)
    }

    throw new Error(
      `GitHub repository lookup failed with status ${String(response.status)}`
    )
  }

  return {
    assertRepositoryExists,
    async getLatestReleaseTag (repoFullName: string) {
      const parsedRepo = parseRepoRef(repoFullName)
      const cacheKey = `github:latest-release:v1:${parsedRepo.repoFullName}`
      const cached = await getCachedJson<LatestReleaseCacheValue>(cache, cacheKey)

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
          throw new Error('GitHub latest release response is missing tag_name')
        }

        await setCachedJson(cache, cacheKey, {
          tag: payload.tag_name
        }, cacheTtlSeconds)

        return payload.tag_name
      }

      if (isRateLimitedResponse(response)) {
        throw new GitHubRateLimitedError()
      }

      if (response.status === 404) {
        await assertRepositoryExists(parsedRepo.repoFullName)
        await setCachedJson(cache, cacheKey, {
          tag: null
        }, cacheTtlSeconds)
        return null
      }

      throw new Error(
        `GitHub latest release lookup failed with status ${String(response.status)}`
      )
    }
  }
}
