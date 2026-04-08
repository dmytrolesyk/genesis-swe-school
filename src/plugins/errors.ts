import fastifySensible from '@fastify/sensible'
import fp from 'fastify-plugin'
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'

import { AppError } from '../shared/errors.ts'

function sendErrorResponse (
  reply: FastifyReply,
  statusCode: number,
  error: string,
  message: string
) {
  return reply.code(statusCode).send({
    statusCode,
    error,
    message
  })
}

export default fp(async function errorsPlugin (fastify) {
  await fastify.register(fastifySensible)

  fastify.setErrorHandler((
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    request.log.error({ err: error }, 'request failed')

    if (error.validation !== undefined) {
      return sendErrorResponse(reply, 400, 'BAD_REQUEST', error.message)
    }

    if (error instanceof AppError) {
      return sendErrorResponse(
        reply,
        error.statusCode,
        error.code,
        error.message
      )
    }

    const statusCode = error.statusCode !== undefined && error.statusCode >= 400
      ? error.statusCode
      : 500
    const message = statusCode >= 500 ? 'Internal Server Error' : error.message
    const errorCode = statusCode >= 500
      ? 'INTERNAL_SERVER_ERROR'
      : error.code

    return sendErrorResponse(reply, statusCode, errorCode, message)
  })
}, {
  name: 'errors'
})
