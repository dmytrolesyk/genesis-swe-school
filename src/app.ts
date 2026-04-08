import Fastify, { type FastifyServerOptions } from 'fastify'

export function buildApp (options: FastifyServerOptions = {}) {
  return Fastify({
    logger: false,
    ...options
  })
}
