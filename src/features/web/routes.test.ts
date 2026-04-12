import { describe, expect, it, vi } from 'vitest'

import { buildApp } from '../../app.ts'
import type { SubscriptionService } from '../subscriptions/service.ts'
import { InvalidRepoFormatError } from '../../shared/errors.ts'

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

describe('public web routes', () => {
  it('renders the subscription home page without an API key', async () => {
    const service = createServiceStub()
    const app = buildApp({}, {
      web: {
        service
      }
    })
    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: '/'
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/html')
    expect(response.body).toContain('Release Notifier XP')
    expect(response.body).toContain('Track a GitHub repo. Get a tiny electronic postcard when it ships.')
    expect(response.body).toContain('Repository')
    expect(response.body).toContain('Email')
    expect(response.body).toContain('Start Watching')
    expect(response.body).toContain('Status')
    await app.close()
  })

  it('serves the public stylesheet', async () => {
    const app = buildApp({}, {
      web: {
        service: createServiceStub()
      }
    })
    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: '/assets/styles/app.css'
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/css')
    await app.close()
  })

  it('serves the browser script', async () => {
    const app = buildApp({}, {
      web: {
        service: createServiceStub()
      }
    })
    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: '/assets/scripts/app.js'
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('javascript')
    await app.close()
  })

  it('serves the background image', async () => {
    const app = buildApp({}, {
      web: {
        service: createServiceStub()
      }
    })
    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: '/assets/images/bg.jpg'
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('image/jpeg')
    await app.close()
  })

  it('submits form fields to the subscription service', async () => {
    const service = createServiceStub()
    const app = buildApp({}, {
      web: {
        service
      }
    })
    await app.ready()

    const response = await app.inject({
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      method: 'POST',
      payload: 'email=user%40example.com&repo=nodejs%2Fnode',
      url: '/subscribe'
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/html')
    expect(response.body).toContain('Inbox armed. Check your email to confirm the subscription.')
    expect(service.subscribe).toHaveBeenCalledWith({
      email: 'user@example.com',
      repo: 'nodejs/node'
    })
    await app.close()
  })

  it('renders an HTML error state when subscription fails', async () => {
    const service = createServiceStub()
    service.subscribe = vi.fn(() => Promise.reject(
      new InvalidRepoFormatError('nodejs')
    ))
    const app = buildApp({}, {
      web: {
        service
      }
    })
    await app.ready()

    const response = await app.inject({
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      method: 'POST',
      payload: 'email=user%40example.com&repo=nodejs',
      url: '/subscribe'
    })

    expect(response.statusCode).toBe(400)
    expect(response.headers['content-type']).toContain('text/html')
    expect(response.body).toContain('Status')
    expect(response.body).toContain('Invalid repository format')
    expect(response.body).toContain('value="user@example.com"')
    expect(response.body).toContain('value="nodejs"')
    await app.close()
  })

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
