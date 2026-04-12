import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildApp } from './app.ts'
import type { ReleaseScheduler } from './features/releases/scheduler.ts'
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

  it('registers the config, database, and cache decorators', async () => {
    app = buildApp()

    await app.ready()

    expect(app.hasDecorator('config')).toBe(true)
    expect(app.hasDecorator('pg')).toBe(true)
    expect(app.hasDecorator('cache')).toBe(true)
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

  it('starts and stops the release scheduler with the app lifecycle', async () => {
    const scheduler: ReleaseScheduler = {
      start: vi.fn(),
      stop: vi.fn()
    }

    app = buildApp({}, {
      releases: {
        scheduler
      }
    })

    await app.ready()

    expect(scheduler.start).toHaveBeenCalledTimes(1)

    await app.close()
    app = undefined

    expect(scheduler.stop).toHaveBeenCalledTimes(1)
  })
})
