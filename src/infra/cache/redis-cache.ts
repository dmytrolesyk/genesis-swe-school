import type { Cache } from './cache.ts'

type RedisClientLike = {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string, options: { EX: number }) => Promise<unknown>
}

export function createRedisCache (client: RedisClientLike): Cache {
  return {
    async getJson<T> (key: string) {
      const rawValue = await client.get(key)

      if (rawValue === null) {
        return null
      }

      try {
        return JSON.parse(rawValue) as T
      } catch {
        return null
      }
    },
    async setJson (key: string, value: unknown, ttlSeconds: number) {
      await client.set(key, JSON.stringify(value), {
        EX: ttlSeconds
      })
    }
  }
}
