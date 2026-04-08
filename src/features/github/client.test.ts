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

function createResponse (status: number) {
  return new Response(null, { status })
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
})
