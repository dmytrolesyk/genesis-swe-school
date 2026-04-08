import fastifyPostgres from '@fastify/postgres'
import fp from 'fastify-plugin'

export default fp(async function databasePlugin (fastify) {
  await fastify.register(fastifyPostgres, {
    connectionString: fastify.config.DATABASE_URL
  })
}, {
  name: 'database',
  dependencies: ['config']
})
