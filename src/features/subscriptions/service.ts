import { randomUUID } from 'node:crypto'

import type { GitHubClient } from '../github/client.ts'
import { parseRepoRef } from '../github/repo-ref.ts'
import type { Mailer } from '../../infra/email/mailer.ts'
import { DuplicateSubscriptionError } from '../../shared/errors.ts'
import type {
  PendingSubscription,
  SubscriptionRepository
} from './repository.ts'

export type SubscribeInput = {
  email: string
  repo: string
}

export type SubscriptionService = {
  subscribe: (input: SubscribeInput) => Promise<void>
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

export function createSubscriptionService (
  options: CreateSubscriptionServiceOptions
): SubscriptionService {
  const generateToken = options.generateToken ?? randomUUID

  return {
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
        confirmUrl: `${options.appBaseUrl}/api/confirm/${pendingSubscription.confirmToken}`,
        email: pendingSubscription.email,
        repoFullName: pendingSubscription.repoFullName,
        unsubscribeUrl: `${options.appBaseUrl}/api/unsubscribe/${pendingSubscription.unsubscribeToken}`
      })
    }
  }
}
