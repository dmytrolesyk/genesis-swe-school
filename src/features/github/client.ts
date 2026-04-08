import {
  GitHubRateLimitedError,
  GitHubRepositoryNotFoundError
} from '../../shared/errors.ts'
import { parseRepoRef } from './repo-ref.ts'

export { parseRepoRef } from './repo-ref.ts'

type FetchLike = typeof fetch

export type GitHubClient = {
  assertRepositoryExists: (repoFullName: string) => Promise<void>
  getLatestReleaseTag: (repoFullName: string) => Promise<string | null>
}

type CreateGitHubClientOptions = {
  fetch?: FetchLike
  token?: string
}

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
  const fetchImplementation = options.fetch ?? globalThis.fetch
  const headers = createHeaders(options.token)

  async function assertRepositoryExists (repoFullName: string) {
    const parsedRepo = parseRepoRef(repoFullName)
    const response = await fetchImplementation(
      `https://api.github.com/repos/${parsedRepo.repoFullName}`,
      {
        headers
      }
    )

    if (response.ok) {
      return
    }

    if (isRateLimitedResponse(response)) {
      throw new GitHubRateLimitedError()
    }

    if (response.status === 404) {
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

        return payload.tag_name
      }

      if (isRateLimitedResponse(response)) {
        throw new GitHubRateLimitedError()
      }

      if (response.status === 404) {
        await assertRepositoryExists(parsedRepo.repoFullName)
        return null
      }

      throw new Error(
        `GitHub latest release lookup failed with status ${String(response.status)}`
      )
    }
  }
}
