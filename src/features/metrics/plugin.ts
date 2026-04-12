import fp from 'fastify-plugin'
import type {
  FastifyPluginCallback,
  FastifyRequest
} from 'fastify'

import { verifyApiKey } from '../../plugins/api-key-auth.ts'
import {
  createMetrics,
  type Metrics
} from './metrics.ts'

declare module 'fastify' {
  interface FastifyInstance {
    metrics: Metrics
  }
}

function routeLabel (url: string | undefined): string {
  return url ?? 'unmatched'
}

const metricsPlugin: FastifyPluginCallback = (fastify, _options, done) => {
  const metrics = createMetrics()
  const startTimes = new WeakMap<FastifyRequest, bigint>()

  fastify.decorate('metrics', metrics)

  fastify.addHook('onRequest', (request, _reply, doneHook) => {
    startTimes.set(request, process.hrtime.bigint())
    doneHook()
  })

  fastify.addHook('onResponse', async (request, reply) => {
    const startTime = startTimes.get(request)

    if (startTime === undefined) {
      return
    }

    startTimes.delete(request)

    const durationSeconds = Number(
      process.hrtime.bigint() - startTime
    ) / 1_000_000_000

    metrics.recordHttpRequest({
      durationSeconds,
      method: request.method,
      route: routeLabel(request.routeOptions.url),
      statusCode: reply.statusCode
    })
  })

  fastify.get('/metrics', {
    preHandler: verifyApiKey
  }, async (_request, reply) => {
    return reply
      .type(metrics.registry.contentType)
      .send(await metrics.registry.metrics())
  })

  done()
}

export default fp(metricsPlugin, {
  dependencies: ['config'],
  name: 'metrics'
})
