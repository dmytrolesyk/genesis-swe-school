import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'

import { buildApp } from './app.ts'
import { InvalidRepoFormatError } from './shared/errors.ts'

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

  it('registers the config and database decorators', async () => {
    app = buildApp()

    await app.ready()

    expect(app.hasDecorator('config')).toBe(true)
    expect(app.hasDecorator('pg')).toBe(true)
    expect(app.config.PORT).toBe(3000)
  })

  it('maps known application errors to structured HTTP responses', async () => {
    app = buildApp()
    app.get('/__test/error', () => {
      throw new InvalidRepoFormatError('owner')
    })

    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: '/__test/error'
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
      statusCode: 400,
      error: 'INVALID_REPO_FORMAT'
    })
  })
})
