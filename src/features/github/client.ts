import {
  GitHubRateLimitedError,
  GitHubRepositoryNotFoundError
} from '../../shared/errors.ts'
import { parseRepoRef } from './repo-ref.ts'

export { parseRepoRef } from './repo-ref.ts'

type FetchLike = typeof fetch

export type GitHubClient = {
  assertRepositoryExists: (repoFullName: string) => Promise<void>
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

export function createGitHubClient (
  options: CreateGitHubClientOptions = {}
): GitHubClient {
  const fetchImplementation = options.fetch ?? globalThis.fetch

  return {
    async assertRepositoryExists (repoFullName: string) {
      const parsedRepo = parseRepoRef(repoFullName)
      const response = await fetchImplementation(
        `https://api.github.com/repos/${parsedRepo.repoFullName}`,
        {
          headers: createHeaders(options.token)
        }
      )

      if (response.ok) {
        return
      }

      if (
        response.status === 429 ||
        (
          response.status === 403 &&
          response.headers.get('x-ratelimit-remaining') === '0'
        )
      ) {
        throw new GitHubRateLimitedError()
      }

      if (response.status === 404) {
        throw new GitHubRepositoryNotFoundError(parsedRepo.repoFullName)
      }

      throw new Error(
        `GitHub repository lookup failed with status ${String(response.status)}`
      )
    }
  }
}
