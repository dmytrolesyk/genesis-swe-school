import type { Pool } from 'pg'

export type ReleaseSubscriber = {
  email: string
  unsubscribeToken: string
}

export type ReleaseRepository = {
  getLastSeenTag: (repoFullName: string) => Promise<string | null>
  listConfirmedSubscribers: (repoFullName: string) => Promise<ReleaseSubscriber[]>
  listSubscribedRepositories: () => Promise<string[]>
  updateLastSeenTag: (repoFullName: string, tag: string) => Promise<void>
}

type LastSeenTagRow = {
  last_seen_tag: string | null
}

type ReleaseSubscriberRow = {
  email: string
  unsubscribe_token: string
}

type SubscribedRepositoryRow = {
  repo_full_name: string
}

export function createReleaseRepository (
  pool: Pick<Pool, 'query'>
): ReleaseRepository {
  return {
    async getLastSeenTag (repoFullName) {
      const result = await pool.query<LastSeenTagRow>(
        `SELECT last_seen_tag
         FROM repositories
         WHERE repo_full_name = $1
         LIMIT 1`,
        [repoFullName]
      )

      return result.rows[0]?.last_seen_tag ?? null
    },
    async listConfirmedSubscribers (repoFullName) {
      const result = await pool.query<ReleaseSubscriberRow>(
        `SELECT email, unsubscribe_token
         FROM subscriptions
         WHERE repo_full_name = $1
           AND confirmed_at IS NOT NULL
           AND unsubscribed_at IS NULL
         ORDER BY created_at ASC, email ASC`,
        [repoFullName]
      )

      return result.rows.map((row) => {
        return {
          email: row.email,
          unsubscribeToken: row.unsubscribe_token
        }
      })
    },
    async listSubscribedRepositories () {
      const result = await pool.query<SubscribedRepositoryRow>(
        `SELECT DISTINCT repo_full_name
         FROM subscriptions
         WHERE confirmed_at IS NOT NULL
           AND unsubscribed_at IS NULL
         ORDER BY repo_full_name ASC`
      )

      return result.rows.map((row) => row.repo_full_name)
    },
    async updateLastSeenTag (repoFullName, tag) {
      await pool.query(
        `UPDATE repositories
         SET last_seen_tag = $2,
             updated_at = now()
         WHERE repo_full_name = $1`,
        [repoFullName, tag]
      )
    }
  }
}
