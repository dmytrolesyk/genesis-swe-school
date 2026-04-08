import { InvalidRepoFormatError } from '../../shared/errors.ts'

export type RepoRef = {
  owner: string
  repo: string
  repoFullName: string
}

export function parseRepoRef (input: string): RepoRef {
  const trimmedInput = input.trim()
  const parts = trimmedInput.split('/')

  if (
    parts.length !== 2 ||
    parts[0].trim() === '' ||
    parts[1].trim() === ''
  ) {
    throw new InvalidRepoFormatError(input)
  }

  const owner = parts[0].trim()
  const repo = parts[1].trim()

  return {
    owner,
    repo,
    repoFullName: `${owner}/${repo}`
  }
}
