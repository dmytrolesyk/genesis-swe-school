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

export type ListedSubscription = {
  confirmed: boolean
  email: string
  last_seen_tag: string | null
  repo: string
}

export type SubscriptionRepository = {
  getSubscriptionsByEmail: (email: string) => Promise<ListedSubscription[]>
  ensureRepository: (repoFullName: string) => Promise<void>
  findActiveSubscription: (
    email: string,
    repoFullName: string
  ) => Promise<ActiveSubscription | null>
  findPendingSubscription: (
    email: string,
    repoFullName: string
  ) => Promise<PendingSubscription | null>
  findByConfirmToken: (token: string) => Promise<ConfirmableSubscription | null>
  findByUnsubscribeToken: (token: string) => Promise<ActiveSubscription | null>
  confirmSubscription: (id: string) => Promise<void>
  insertPendingSubscription: (subscription: PendingSubscription) => Promise<void>
  unsubscribe: (id: string) => Promise<void>
}

type ActiveSubscriptionRow = {
  id: string
}

type ConfirmableSubscriptionRow = {
  confirmed_at: Date | null
  id: string
}

type PendingSubscriptionRow = {
  confirm_token: string
  email: string
  id: string
  repo_full_name: string
  unsubscribe_token: string
}

type ListedSubscriptionRow = {
  confirmed: boolean
  email: string
  last_seen_tag: string | null
  repo: string
}

export function createSubscriptionRepository (
  pool: Pick<Pool, 'query'>
): SubscriptionRepository {
  return {
    async getSubscriptionsByEmail (email) {
      const result = await pool.query<ListedSubscriptionRow>(
        `SELECT
           subscriptions.email,
           subscriptions.repo_full_name AS repo,
           subscriptions.confirmed_at IS NOT NULL AS confirmed,
           repositories.last_seen_tag
         FROM subscriptions
         INNER JOIN repositories
           ON repositories.repo_full_name = subscriptions.repo_full_name
         WHERE subscriptions.email = $1
           AND subscriptions.unsubscribed_at IS NULL
         ORDER BY subscriptions.created_at ASC, subscriptions.repo_full_name ASC`,
        [email]
      )

      return result.rows
    },
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
           AND confirmed_at IS NOT NULL
           AND unsubscribed_at IS NULL
         LIMIT 1`,
        [email, repoFullName]
      )

      return result.rows[0] ?? null
    },
    async findPendingSubscription (email, repoFullName) {
      const result = await pool.query<PendingSubscriptionRow>(
        `SELECT id, email, repo_full_name, confirm_token, unsubscribe_token
         FROM subscriptions
         WHERE email = $1
           AND repo_full_name = $2
           AND confirmed_at IS NULL
           AND unsubscribed_at IS NULL
         LIMIT 1`,
        [email, repoFullName]
      )

      if (result.rows.length === 0) {
        return null
      }

      const row = result.rows[0]

      return {
        confirmToken: row.confirm_token,
        email: row.email,
        id: row.id,
        repoFullName: row.repo_full_name,
        unsubscribeToken: row.unsubscribe_token
      }
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
    async findByUnsubscribeToken (token) {
      const result = await pool.query<ActiveSubscriptionRow>(
        `SELECT id
         FROM subscriptions
         WHERE unsubscribe_token = $1
           AND unsubscribed_at IS NULL
         LIMIT 1`,
        [token]
      )

      return result.rows[0] ?? null
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
    },
    async unsubscribe (id) {
      await pool.query(
        `UPDATE subscriptions
         SET unsubscribed_at = COALESCE(unsubscribed_at, now()),
             updated_at = now()
         WHERE id = $1`,
        [id]
      )
    }
  }
}
