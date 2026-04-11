import { randomUUID } from 'node:crypto'

import type { GitHubClient } from '../github/client.ts'
import { parseRepoRef } from '../github/repo-ref.ts'
import type { Mailer } from '../../infra/email/mailer.ts'
import {
  DuplicateSubscriptionError,
  InvalidTokenError,
  TokenNotFoundError
} from '../../shared/errors.ts'
import type {
  ListedSubscription,
  PendingSubscription,
  SubscriptionRepository
} from './repository.ts'

export type SubscribeInput = {
  email: string
  repo: string
}

export type SubscriptionService = {
  confirmSubscription: (token: string) => Promise<void>
  getSubscriptionsByEmail: (email: string) => Promise<ListedSubscription[]>
  subscribe: (input: SubscribeInput) => Promise<void>
  unsubscribe: (token: string) => Promise<void>
}

type CreateSubscriptionServiceOptions = {
  appBaseUrl: string
  generateToken?: () => string
  githubClient: GitHubClient
  mailer: Mailer
  repository: SubscriptionRepository
}

function buildPendingSubscription (
  input: SubscribeInput,
  repoFullName: string,
  generateToken: () => string
): PendingSubscription {
  return {
    id: generateToken(),
    confirmToken: generateToken(),
    email: input.email,
    repoFullName,
    unsubscribeToken: generateToken()
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function assertValidToken (token: string) {
  if (!uuidPattern.test(token)) {
    throw new InvalidTokenError(token)
  }
}

export function createSubscriptionService (
  options: CreateSubscriptionServiceOptions
): SubscriptionService {
  const generateToken = options.generateToken ?? randomUUID

  return {
    async confirmSubscription (token) {
      assertValidToken(token)

      const subscription = await options.repository.findByConfirmToken(token)

      if (subscription === null) {
        throw new TokenNotFoundError()
      }

      if (subscription.confirmedAt !== null) {
        return
      }

      await options.repository.confirmSubscription(subscription.id)
    },
    async getSubscriptionsByEmail (email) {
      return options.repository.getSubscriptionsByEmail(email)
    },
    async subscribe (input) {
      const parsedRepo = parseRepoRef(input.repo)
      await options.githubClient.assertRepositoryExists(parsedRepo.repoFullName)

      const existingSubscription = await options.repository.findActiveSubscription(
        input.email,
        parsedRepo.repoFullName
      )

      if (existingSubscription !== null) {
        throw new DuplicateSubscriptionError(input.email, parsedRepo.repoFullName)
      }

      await options.repository.ensureRepository(parsedRepo.repoFullName)

      const pendingSubscription = buildPendingSubscription(
        input,
        parsedRepo.repoFullName,
        generateToken
      )

      await options.repository.insertPendingSubscription(pendingSubscription)
      await options.mailer.sendConfirmationEmail({
        confirmUrl: `${options.appBaseUrl}/confirm/${pendingSubscription.confirmToken}`,
        email: pendingSubscription.email,
        repoFullName: pendingSubscription.repoFullName,
        unsubscribeUrl: `${options.appBaseUrl}/unsubscribe/${pendingSubscription.unsubscribeToken}`
      })
    },
    async unsubscribe (token) {
      assertValidToken(token)

      const subscription = await options.repository.findByUnsubscribeToken(token)

      if (subscription === null) {
        throw new TokenNotFoundError()
      }

      await options.repository.unsubscribe(subscription.id)
    }
  }
}
