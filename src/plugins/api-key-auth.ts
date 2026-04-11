import fp from 'fastify-plugin'
import type {
  FastifyPluginCallback,
  FastifyReply,
  FastifyRequest
} from 'fastify'

function readApiKeyHeader (request: FastifyRequest): string | undefined {
  const header = request.headers['x-api-key']

  return Array.isArray(header) ? header[0] : header
}

export async function verifyApiKey (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (readApiKeyHeader(request) !== request.server.config.API_KEY) {
    await reply.code(401).send({
      statusCode: 401,
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid API key'
    })
  }
}

const apiKeyAuthPlugin: FastifyPluginCallback = (fastify, _options, done) => {
  fastify.addHook('onRequest', verifyApiKey)
  done()
}

export default fp(apiKeyAuthPlugin, {
  name: 'api-key-auth',
  dependencies: ['config']
})
