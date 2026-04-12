import { describe, expect, it } from 'vitest'

import { buildApp } from '../../app.ts'

describe('/metrics', () => {
  it('requires the API key', async () => {
    const app = buildApp()
    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: '/metrics'
    })

    expect(response.statusCode).toBe(401)
    await app.close()
  })

  it('rejects the wrong API key', async () => {
    const app = buildApp()
    await app.ready()

    const response = await app.inject({
      headers: {
        'x-api-key': 'wrong-key'
      },
      method: 'GET',
      url: '/metrics'
    })

    expect(response.statusCode).toBe(401)
    await app.close()
  })

  it('returns prometheus text with the API key', async () => {
    const app = buildApp()
    await app.ready()

    await app.inject({
      method: 'GET',
      url: '/confirm/00000000-0000-4000-8000-000000000001'
    })

    const response = await app.inject({
      headers: {
        'x-api-key': 'local-dev-key'
      },
      method: 'GET',
      url: '/metrics'
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/plain')
    expect(response.body).toContain('http_requests_total')
    await app.close()
  })
})
