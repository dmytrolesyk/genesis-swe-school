import { describe, expect, it, vi } from 'vitest'

import { buildApp } from '../../app.ts'
import type { SubscriptionService } from '../subscriptions/service.ts'
import { InvalidRepoFormatError } from '../../shared/errors.ts'

const validToken = '00000000-0000-4000-8000-000000000001'
const listedSubscriptions = [
  {
    confirmed: true,
    email: 'user@example.com',
    last_seen_tag: 'v1.0.0',
    repo: 'nodejs/node'
  }
]

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
  it('renders an embeddable subscription widget without the XP chrome', async () => {
    const service = createServiceStub()
    const app = buildApp({}, {
      web: {
        service
      }
    })
    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: '/embed/subscribe'
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/html')
    expect(response.body).toContain('class="embed-page"')
    expect(response.body).not.toContain('id="xp-taskbar"')
    expect(response.body).not.toContain('id="xp-start-menu"')
    expect(response.body).toContain('action="/embed/subscribe"')
    expect(response.body).not.toContain('Interview Prep Arcade')
    await app.close()
  })

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
    expect(response.body).toContain('href="/assets/styles/app.css"')
    expect(response.body).toContain('src="/assets/scripts/app.js"')
    expect(response.body).toContain('id="xp-taskbar"')
    expect(response.body).toContain('id="xp-start-menu"')
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
    expect(response.body).toContain('localStorage')
    expect(response.body).toContain('Load subscriptions')
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

  it('returns confirmed subscriptions by email without an API key for the start menu', async () => {
    const service = createServiceStub()
    service.getSubscriptionsByEmail = vi.fn(() => Promise.resolve([
      ...listedSubscriptions,
      {
        confirmed: false,
        email: 'user@example.com',
        last_seen_tag: null,
        repo: 'forrestchang/andrej-karpathy-skills'
      }
    ]))
    const app = buildApp({}, {
      web: {
        service
      }
    })
    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: '/subscriptions?email=user@example.com'
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(listedSubscriptions)
    expect(service.getSubscriptionsByEmail).toHaveBeenCalledWith('user@example.com')
    await app.close()
  })

  it('rejects invalid public subscription lookup emails', async () => {
    const service = createServiceStub()
    const app = buildApp({}, {
      web: {
        service
      }
    })
    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: '/subscriptions?email=not-an-email'
    })

    expect(response.statusCode).toBe(400)
    expect(service.getSubscriptionsByEmail).not.toHaveBeenCalled()
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

  it('keeps the embeddable widget chrome-free after form submission', async () => {
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
      url: '/embed/subscribe'
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/html')
    expect(response.body).toContain('class="embed-page"')
    expect(response.body).not.toContain('id="xp-taskbar"')
    expect(response.body).not.toContain('id="xp-start-menu"')
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

  it('renders the interview prep quiz page without an API key', async () => {
    const app = buildApp({}, {
      web: {
        service: createServiceStub()
      }
    })
    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: '/quiz'
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/html')
    expect(response.body).toContain('Interview Prep Arcade')
    expect(response.body).toContain('data-quiz-root')
    expect(response.body).toContain('href="/assets/styles/quiz.css"')
    expect(response.body).toContain('src="/assets/scripts/quiz.js"')
    await app.close()
  })

  it('serves the quiz stylesheet', async () => {
    const app = buildApp({}, {
      web: {
        service: createServiceStub()
      }
    })
    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: '/assets/styles/quiz.css'
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/css')
    await app.close()
  })

  it('serves the quiz runtime script', async () => {
    const app = buildApp({}, {
      web: {
        service: createServiceStub()
      }
    })
    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: '/assets/scripts/quiz.js'
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('javascript')
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
