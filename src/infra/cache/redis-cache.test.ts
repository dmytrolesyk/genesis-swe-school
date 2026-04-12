import { describe, expect, it, vi } from 'vitest'

import { createRedisCache } from './redis-cache.ts'

type RedisClientLike = {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string, options: { EX: number }) => Promise<unknown>
}

function createClientStub (): RedisClientLike {
  return {
    get: vi.fn(() => Promise.resolve(null)),
    set: vi.fn(() => Promise.resolve('OK'))
  }
}

describe('createRedisCache', () => {
  it('parses JSON values from Redis', async () => {
    const client = createClientStub()
    client.get = vi.fn(() => Promise.resolve('{"tag":"v1.0.0"}'))
    const cache = createRedisCache(client)

    await expect(cache.getJson<{ tag: string }>('github:latest-release:v1:nodejs/node')).resolves.toEqual({
      tag: 'v1.0.0'
    })
    expect(client.get).toHaveBeenCalledWith('github:latest-release:v1:nodejs/node')
  })

  it('returns null for missing keys', async () => {
    const cache = createRedisCache(createClientStub())

    await expect(cache.getJson('github:missing')).resolves.toBeNull()
  })

  it('returns null for invalid JSON', async () => {
    const client = createClientStub()
    client.get = vi.fn(() => Promise.resolve('not-json'))
    const cache = createRedisCache(client)

    await expect(cache.getJson('github:broken')).resolves.toBeNull()
  })

  it('serializes values with a TTL', async () => {
    const client = createClientStub()
    const cache = createRedisCache(client)

    await cache.setJson('github:repo-exists:v1:nodejs/node', {
      exists: true
    }, 600)

    expect(client.set).toHaveBeenCalledWith(
      'github:repo-exists:v1:nodejs/node',
      '{"exists":true}',
      {
        EX: 600
      }
    )
  })
})
