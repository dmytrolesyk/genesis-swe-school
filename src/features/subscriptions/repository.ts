import type { Pool } from 'pg'

export type ActiveSubscription = {
  id: string
}

export type ConfirmableSubscription = {
  confirmedAt: Date | null
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
  findByConfirmToken: (token: string) => Promise<ConfirmableSubscription | null>
  confirmSubscription: (id: string) => Promise<void>
  insertPendingSubscription: (subscription: PendingSubscription) => Promise<void>
}

type ActiveSubscriptionRow = {
  id: string
}

type ConfirmableSubscriptionRow = {
  confirmed_at: Date | null
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
    async findByConfirmToken (token) {
      const result = await pool.query<ConfirmableSubscriptionRow>(
        `SELECT id, confirmed_at
         FROM subscriptions
         WHERE confirm_token = $1
           AND unsubscribed_at IS NULL
         LIMIT 1`,
        [token]
      )

      if (result.rows.length === 0) {
        return null
      }

      const row = result.rows[0]

      return {
        confirmedAt: row.confirmed_at,
        id: row.id
      }
    },
    async confirmSubscription (id) {
      await pool.query(
        `UPDATE subscriptions
         SET confirmed_at = COALESCE(confirmed_at, now()),
             updated_at = now()
         WHERE id = $1`,
        [id]
      )
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
