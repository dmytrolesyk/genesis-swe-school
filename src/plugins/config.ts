import envSchema from 'env-schema'
import fp from 'fastify-plugin'
import { Type, type Static } from '@sinclair/typebox'

export const configSchema = Type.Object({
  HOST: Type.String({ default: '0.0.0.0' }),
  PORT: Type.Integer({ default: 3000 }),
  DATABASE_URL: Type.String({
    default: 'postgres://postgres:postgres@localhost:5432/releases'
  }),
  APP_BASE_URL: Type.String({ default: 'http://localhost:3000' }),
  SCAN_INTERVAL_MS: Type.Integer({ default: 60000 }),
  GITHUB_TOKEN: Type.Optional(Type.String()),
  SMTP_HOST: Type.String({ default: 'localhost' }),
  SMTP_PORT: Type.Integer({ default: 1025 }),
  SMTP_USER: Type.Optional(Type.String()),
  SMTP_PASS: Type.Optional(Type.String()),
  SMTP_FROM: Type.String({ default: 'noreply@example.com' })
})

export type AppConfig = Static<typeof configSchema>

export function loadConfig (): AppConfig {
  return envSchema<AppConfig>({
    schema: configSchema,
    dotenv: true
  })
}

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig
  }
}

export default fp(function configPlugin (fastify) {
  fastify.decorate('config', loadConfig())
}, {
  name: 'config'
})
