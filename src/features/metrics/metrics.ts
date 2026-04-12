import * as client from 'prom-client'

export type Metrics = {
  githubCache: (operation: string, result: string) => void
  githubRequest: (operation: string, result: string) => void
  recordHttpRequest: (input: {
    durationSeconds: number
    method: string
    route: string
    statusCode: number
  }) => void
  registry: client.Registry
  releaseNotification: (result: string) => void
  scannerRun: (result: string) => void
  subscriptionsConfirmed: () => void
  subscriptionsCreated: () => void
  subscriptionsUnsubscribed: () => void
}

export function createMetrics (): Metrics {
  const registry = new client.Registry()
  client.collectDefaultMetrics({
    register: registry
  })

  const httpRequests = new client.Counter({
    help: 'Total HTTP requests.',
    labelNames: ['method', 'route', 'status_code'],
    name: 'http_requests_total',
    registers: [registry]
  })

  const httpDuration = new client.Histogram({
    help: 'HTTP request duration in seconds.',
    labelNames: ['method', 'route', 'status_code'],
    name: 'http_request_duration_seconds',
    registers: [registry]
  })

  const subscriptionsCreated = new client.Counter({
    help: 'Total successful subscription creation requests.',
    name: 'subscriptions_created_total',
    registers: [registry]
  })

  const subscriptionsConfirmed = new client.Counter({
    help: 'Total successful subscription confirmations.',
    name: 'subscriptions_confirmed_total',
    registers: [registry]
  })

  const subscriptionsUnsubscribed = new client.Counter({
    help: 'Total successful unsubscribes.',
    name: 'subscriptions_unsubscribed_total',
    registers: [registry]
  })

  const githubRequests = new client.Counter({
    help: 'Total GitHub API requests.',
    labelNames: ['operation', 'result'],
    name: 'github_requests_total',
    registers: [registry]
  })

  const githubCache = new client.Counter({
    help: 'Total GitHub cache lookups.',
    labelNames: ['operation', 'result'],
    name: 'github_cache_total',
    registers: [registry]
  })

  const scannerRuns = new client.Counter({
    help: 'Total release scanner runs.',
    labelNames: ['result'],
    name: 'release_scanner_runs_total',
    registers: [registry]
  })

  const releaseNotifications = new client.Counter({
    help: 'Total release notification email attempts.',
    labelNames: ['result'],
    name: 'release_notifications_sent_total',
    registers: [registry]
  })

  return {
    githubCache (operation, result) {
      githubCache.inc({
        operation,
        result
      })
    },
    githubRequest (operation, result) {
      githubRequests.inc({
        operation,
        result
      })
    },
    recordHttpRequest (input) {
      const labels = {
        method: input.method,
        route: input.route,
        status_code: String(input.statusCode)
      }

      httpRequests.inc(labels)
      httpDuration.observe(labels, input.durationSeconds)
    },
    registry,
    releaseNotification (result) {
      releaseNotifications.inc({
        result
      })
    },
    scannerRun (result) {
      scannerRuns.inc({
        result
      })
    },
    subscriptionsConfirmed () {
      subscriptionsConfirmed.inc()
    },
    subscriptionsCreated () {
      subscriptionsCreated.inc()
    },
    subscriptionsUnsubscribed () {
      subscriptionsUnsubscribed.inc()
    }
  }
}

export function createNoopMetrics (): Metrics {
  return {
    githubCache () {},
    githubRequest () {},
    recordHttpRequest () {},
    registry: new client.Registry(),
    releaseNotification () {},
    scannerRun () {},
    subscriptionsConfirmed () {},
    subscriptionsCreated () {},
    subscriptionsUnsubscribed () {}
  }
}
