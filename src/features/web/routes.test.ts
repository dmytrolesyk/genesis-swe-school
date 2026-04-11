import { describe, expect, it, vi } from 'vitest'

import { buildApp } from '../../app.ts'
import type { SubscriptionService } from '../subscriptions/service.ts'

const validToken = '00000000-0000-4000-8000-000000000001'

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

describe('public token routes', () => {
  it('confirms subscriptions without an API key', async () => {
    const service = createServiceStub()
    const app = buildApp({}, {
      web: {
        service
      }
    })
    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: `/confirm/${validToken}`
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/html')
    expect(response.body).toContain('Subscription confirmed')
    expect(service.confirmSubscription).toHaveBeenCalledWith(validToken)
    await app.close()
  })

  it('unsubscribes without an API key', async () => {
    const service = createServiceStub()
    const app = buildApp({}, {
      web: {
        service
      }
    })
    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: `/unsubscribe/${validToken}`
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/html')
    expect(response.body).toContain('Unsubscribed')
    expect(service.unsubscribe).toHaveBeenCalledWith(validToken)
    await app.close()
  })
})
