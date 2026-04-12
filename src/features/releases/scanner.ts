import type { GitHubClient } from '../github/client.ts'
import type { Metrics } from '../metrics/metrics.ts'
import type { Mailer } from '../../infra/email/mailer.ts'
import type { ReleaseRepository } from './repository.ts'

export type ReleaseScanner = {
  scanAllRepositories: () => Promise<void>
}

type CreateReleaseScannerOptions = {
  appBaseUrl: string
  githubClient: Pick<GitHubClient, 'getLatestReleaseTag'>
  mailer: Pick<Mailer, 'sendReleaseEmail'>
  metrics?: Pick<Metrics, 'releaseNotification' | 'scannerRun'>
  repository: ReleaseRepository
}

function recordMetric (record: () => void): void {
  try {
    record()
  } catch {}
}

export function createReleaseScanner (
  options: CreateReleaseScannerOptions
): ReleaseScanner {
  return {
    async scanAllRepositories () {
      try {
        const repositories = await options.repository.listSubscribedRepositories()

        for (const repoFullName of repositories) {
          try {
            const latestTag = await options.githubClient.getLatestReleaseTag(repoFullName)

            if (latestTag === null) {
              continue
            }

            const lastSeenTag = await options.repository.getLastSeenTag(repoFullName)

            if (lastSeenTag === latestTag) {
              continue
            }

            if (lastSeenTag === null) {
              await options.repository.updateLastSeenTag(repoFullName, latestTag)
              continue
            }

            const subscribers = await options.repository.listConfirmedSubscribers(repoFullName)

            for (const subscriber of subscribers) {
              try {
                await options.mailer.sendReleaseEmail({
                  email: subscriber.email,
                  repoFullName,
                  tag: latestTag,
                  unsubscribeUrl: `${options.appBaseUrl}/unsubscribe/${subscriber.unsubscribeToken}`
                })
                recordMetric(() => {
                  options.metrics?.releaseNotification('success')
                })
              } catch (error) {
                recordMetric(() => {
                  options.metrics?.releaseNotification('failure')
                })
                throw error
              }
            }

            await options.repository.updateLastSeenTag(repoFullName, latestTag)
          } catch {}
        }

        recordMetric(() => {
          options.metrics?.scannerRun('success')
        })
      } catch (error) {
        recordMetric(() => {
          options.metrics?.scannerRun('failure')
        })
        throw error
      }
    }
  }
}
