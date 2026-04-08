import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'

import { buildApp } from './app.ts'

describe('buildApp', () => {
  let app: FastifyInstance | undefined

  afterEach(async () => {
    if (app !== undefined) {
      await app.close()
    }
  })

  it('creates an app instance that can handle an injected request', async () => {
    app = buildApp()

    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: '/'
    })

    expect(response.statusCode).toBe(404)
  })
})
