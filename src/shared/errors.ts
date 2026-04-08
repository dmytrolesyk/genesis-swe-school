type AppErrorOptions = {
  code: string
  message: string
  statusCode: number
}

export class AppError extends Error {
  readonly code: string
  readonly statusCode: number

  constructor (options: AppErrorOptions) {
    super(options.message)
    this.name = new.target.name
    this.code = options.code
    this.statusCode = options.statusCode
  }
}

export class InvalidRepoFormatError extends AppError {
  constructor (repo: string) {
    super({
      code: 'INVALID_REPO_FORMAT',
      message: `Invalid repository format: ${repo}`,
      statusCode: 400
    })
  }
}

export class DuplicateSubscriptionError extends AppError {
  constructor (email: string, repo: string) {
    super({
      code: 'DUPLICATE_SUBSCRIPTION',
      message: `${email} is already subscribed to ${repo}`,
      statusCode: 409
    })
  }
}

export class InvalidTokenError extends AppError {
  constructor (token: string) {
    super({
      code: 'INVALID_TOKEN',
      message: `Invalid token: ${token}`,
      statusCode: 400
    })
  }
}

export class TokenNotFoundError extends AppError {
  constructor () {
    super({
      code: 'TOKEN_NOT_FOUND',
      message: 'Token not found',
      statusCode: 404
    })
  }
}

export class GitHubRepositoryNotFoundError extends AppError {
  constructor (repo: string) {
    super({
      code: 'GITHUB_REPOSITORY_NOT_FOUND',
      message: `GitHub repository not found: ${repo}`,
      statusCode: 404
    })
  }
}

export class GitHubRateLimitedError extends AppError {
  constructor () {
    super({
      code: 'GITHUB_RATE_LIMITED',
      message: 'GitHub API rate limit exceeded',
      statusCode: 503
    })
  }
}
