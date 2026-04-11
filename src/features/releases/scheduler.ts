import fp from 'fastify-plugin'
import {
  type FastifyPluginCallback,
  type FastifyPluginOptions
} from 'fastify'

import {
  createGitHubClient,
  type GitHubClient
} from '../github/client.ts'
import {
  createMailer,
  type Mailer
} from '../../infra/email/mailer.ts'
import {
  createReleaseRepository,
  type ReleaseRepository
} from './repository.ts'
import {
  createReleaseScanner,
  type ReleaseScanner
} from './scanner.ts'

export type ReleaseScheduler = {
  start: () => void
  stop: () => void
}

type CreateReleaseSchedulerOptions = {
  intervalMs: number
  scanner: ReleaseScanner
}

export type ReleaseSchedulerOptions = FastifyPluginOptions & {
  githubClient?: Pick<GitHubClient, 'getLatestReleaseTag'>
  intervalMs?: number
  mailer?: Pick<Mailer, 'sendReleaseEmail'>
  repository?: ReleaseRepository
  scanner?: ReleaseScanner
  scheduler?: ReleaseScheduler
}

export function createReleaseScheduler (
  options: CreateReleaseSchedulerOptions
): ReleaseScheduler {
  let activeRun: Promise<void> | null = null
  let timer: ReturnType<typeof setInterval> | null = null

  async function runScan () {
    if (activeRun !== null) {
      return
    }

    activeRun = options.scanner.scanAllRepositories()

    try {
      await activeRun
    } finally {
      activeRun = null
    }
  }

  return {
    start () {
      if (timer !== null) {
        return
      }

      timer = setInterval(() => {
        runScan().catch(() => undefined)
      }, options.intervalMs)
    },
    stop () {
      if (timer === null) {
        return
      }

      clearInterval(timer)
      timer = null
    }
  }
}

const releaseSchedulerPlugin: FastifyPluginCallback<ReleaseSchedulerOptions> = (
  fastify,
  options,
  done
) => {
  const githubClient = options.githubClient ?? createGitHubClient({
    token: fastify.config.GITHUB_TOKEN
  })
  const mailer = options.mailer ?? createMailer({
    from: fastify.config.SMTP_FROM,
    host: fastify.config.SMTP_HOST,
    pass: fastify.config.SMTP_PASS,
    port: fastify.config.SMTP_PORT,
    user: fastify.config.SMTP_USER
  })
  const repository = options.repository ?? createReleaseRepository(fastify.pg)
  const scanner = options.scanner ?? createReleaseScanner({
    appBaseUrl: fastify.config.APP_BASE_URL,
    githubClient,
    mailer,
    repository
  })
  const scheduler = options.scheduler ?? createReleaseScheduler({
    intervalMs: options.intervalMs ?? fastify.config.SCAN_INTERVAL_MS,
    scanner
  })

  fastify.addHook('onReady', () => {
    scheduler.start()
  })
  fastify.addHook('onClose', () => {
    scheduler.stop()
  })

  done()
}

export default fp(releaseSchedulerPlugin, {
  name: 'release-scheduler',
  dependencies: ['config', 'database']
})
