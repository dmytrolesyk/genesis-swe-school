import { Type } from '@sinclair/typebox'

import { httpErrorSchema } from '../../shared/schemas.ts'

export const subscribeBodySchema = Type.Object({
  email: Type.String(),
  repo: Type.String()
}, {
  additionalProperties: false
})

export const confirmParamsSchema = Type.Object({
  token: Type.String({
    format: 'uuid'
  })
}, {
  additionalProperties: false
})

export const confirmResponseSchema = {
  params: confirmParamsSchema,
  response: {
    200: Type.Object({}),
    400: httpErrorSchema,
    404: httpErrorSchema
  }
}

export const unsubscribeResponseSchema = {
  params: confirmParamsSchema,
  response: {
    200: Type.Object({}),
    400: httpErrorSchema,
    404: httpErrorSchema
  }
}

export const subscriptionsQuerySchema = Type.Object({
  email: Type.String({
    format: 'email'
  })
}, {
  additionalProperties: false
})

export const subscriptionSchema = Type.Object({
  confirmed: Type.Boolean(),
  email: Type.String(),
  last_seen_tag: Type.Union([
    Type.String(),
    Type.Null()
  ]),
  repo: Type.String()
}, {
  additionalProperties: false
})

export const subscriptionsResponseSchema = {
  querystring: subscriptionsQuerySchema,
  response: {
    200: Type.Array(subscriptionSchema),
    400: httpErrorSchema
  }
}

export const subscribeResponseSchema = {
  body: subscribeBodySchema,
  response: {
    200: Type.Object({}),
    400: httpErrorSchema,
    404: httpErrorSchema,
    409: httpErrorSchema,
    503: httpErrorSchema
  }
}
