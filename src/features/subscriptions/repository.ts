import type { Pool } from 'pg'

export type ActiveSubscription = {
  id: string
}

export type PendingSubscription = {
  confirmToken: string
  email: string
  id: string
  repoFullName: string
  unsubscribeToken: string
}

export type SubscriptionRepository = {
  ensureRepository: (repoFullName: string) => Promise<void>
  findActiveSubscription: (
    email: string,
    repoFullName: string
  ) => Promise<ActiveSubscription | null>
  insertPendingSubscription: (subscription: PendingSubscription) => Promise<void>
}

type ActiveSubscriptionRow = {
  id: string
}

export function createSubscriptionRepository (
  pool: Pick<Pool, 'query'>
): SubscriptionRepository {
  return {
    async ensureRepository (repoFullName) {
      await pool.query(
        `INSERT INTO repositories(repo_full_name)
         VALUES ($1)
         ON CONFLICT (repo_full_name) DO NOTHING`,
        [repoFullName]
      )
    },
    async findActiveSubscription (email, repoFullName) {
      const result = await pool.query<ActiveSubscriptionRow>(
        `SELECT id
         FROM subscriptions
         WHERE email = $1
           AND repo_full_name = $2
           AND unsubscribed_at IS NULL
         LIMIT 1`,
        [email, repoFullName]
      )

      return result.rows[0] ?? null
    },
    async insertPendingSubscription (subscription) {
      await pool.query(
        `INSERT INTO subscriptions(
          id,
          email,
          repo_full_name,
          confirm_token,
          unsubscribe_token
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5
        )`,
        [
          subscription.id,
          subscription.email,
          subscription.repoFullName,
          subscription.confirmToken,
          subscription.unsubscribeToken
        ]
      )
    }
  }
}
