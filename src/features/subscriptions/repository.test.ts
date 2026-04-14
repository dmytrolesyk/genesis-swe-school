import { describe, expect, it, vi } from 'vitest'

import type { Pool } from 'pg'

import { createSubscriptionRepository } from './repository.ts'

describe('createSubscriptionRepository', () => {
  it('treats active subscriptions as confirmed when checking duplicates', async () => {
    const query = vi.fn(() => Promise.resolve({
      command: 'SELECT',
      fields: [],
      oid: 0,
      rowCount: 0,
      rows: []
    }))
    const repository = createSubscriptionRepository({
      query: query as unknown as Pool['query']
    })

    await repository.findActiveSubscription('user@example.com', 'openai/openai-node')

    const calls = (query as unknown as { mock: { calls: unknown[][] } }).mock.calls
    const sqlValue = calls[0]?.[0]
    const sql = typeof sqlValue === 'string' ? sqlValue : ''
    expect(sql).toContain('confirmed_at IS NOT NULL')
  })
})
