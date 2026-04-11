import { describe, expect, it, vi } from 'vitest'

import { buildApp } from '../app.ts'
import type { SubscriptionService } from '../features/subscriptions/service.ts'

const apiKey = 'local-dev-key'

function createResolvedVoidMock () {
  return vi.fn(() => Promise.resolve())
}

function createServiceStub (): SubscriptionService {
  return {
    confirmSubscription: createResolvedVoidMock(),
    getSubscriptionsByEmail: vi.fn(() => Promise.resolve([])),
    subscribe: createResolvedVoidMock(),
    unsubscribe: createResolvedVoidMock()
  }
}

describe('API key auth', () => {
  it('rejects protected API requests without x-api-key', async () => {
    const service = createServiceStub()
    const app = buildApp({}, {
      subscriptions: {
        service
      }
    })
    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: '/api/subscriptions?email=user@example.com'
    })

    expect(response.statusCode).toBe(401)
    expect(service.getSubscriptionsByEmail).not.toHaveBeenCalled()
    await app.close()
  })

  it('rejects protected API requests with the wrong x-api-key', async () => {
    const service = createServiceStub()
    const app = buildApp({}, {
      subscriptions: {
        service
      }
    })
    await app.ready()

    const response = await app.inject({
      headers: {
        'x-api-key': 'wrong-key'
      },
      method: 'GET',
      url: '/api/subscriptions?email=user@example.com'
    })

    expect(response.statusCode).toBe(401)
    expect(service.getSubscriptionsByEmail).not.toHaveBeenCalled()
    await app.close()
  })

  it('allows protected API requests with the configured x-api-key', async () => {
    const service = createServiceStub()
    const app = buildApp({}, {
      subscriptions: {
        service
      }
    })
    await app.ready()

    const response = await app.inject({
      headers: {
        'x-api-key': apiKey
      },
      method: 'GET',
      url: '/api/subscriptions?email=user@example.com'
    })

    expect(response.statusCode).not.toBe(401)
    expect(service.getSubscriptionsByEmail).toHaveBeenCalledWith('user@example.com')
    await app.close()
  })
})
