import { createClient, type RedisClientType } from 'redis'
import fp from 'fastify-plugin'

import {
  nullCache,
  type Cache
} from '../infra/cache/cache.ts'
import { createRedisCache } from '../infra/cache/redis-cache.ts'

declare module 'fastify' {
  interface FastifyInstance {
    cache: Cache
  }
}

async function closeRedisClient (client: RedisClientType): Promise<void> {
  if (client.isOpen) {
    await client.quit()
  }
}

export default fp(async function cachePlugin (fastify) {
  if (fastify.config.REDIS_URL === undefined || fastify.config.REDIS_URL === '') {
    fastify.decorate('cache', nullCache)
    return
  }

  const client: RedisClientType = createClient({
    socket: {
      connectTimeout: 1000,
      reconnectStrategy: false
    },
    url: fastify.config.REDIS_URL
  })

  client.on('error', (error: Error) => {
    fastify.log.warn({ err: error }, 'Redis cache error')
  })

  try {
    await client.connect()
  } catch (error) {
    fastify.log.warn({ err: error }, 'Redis cache unavailable; continuing without cache')
    await closeRedisClient(client)
    fastify.decorate('cache', nullCache)
    return
  }

  fastify.decorate('cache', createRedisCache(client))
  fastify.addHook('onClose', async () => {
    await closeRedisClient(client)
  })
}, {
  name: 'cache',
  dependencies: ['config']
})
