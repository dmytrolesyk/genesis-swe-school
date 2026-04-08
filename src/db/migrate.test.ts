import { describe, expect, it, vi } from 'vitest'

import { runMigrations } from './migrate.ts'

describe('runMigrations', () => {
  it('applies only pending migrations in filename order', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ name: '001_initial.sql' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    const client = {
      query,
      release: vi.fn()
    }

    const pool = {
      connect: vi.fn(() => Promise.resolve(client))
    }

    const readDir = vi.fn(() => Promise.resolve([
      { name: '002_add_index.sql', isFile: () => true },
      { name: '001_initial.sql', isFile: () => true }
    ]))

    const readFile = vi.fn((filePath: string) => {
      if (filePath.endsWith('002_add_index.sql')) {
        return Promise.resolve('CREATE INDEX idx_subscriptions_email ON subscriptions(email);')
      }

      return Promise.resolve('CREATE TABLE subscriptions (email text);')
    })

    await runMigrations({
      migrationsDir: '/virtual/migrations',
      pool,
      readDir,
      readFile
    })

    expect(readFile).toHaveBeenCalledTimes(1)
    expect(readFile).toHaveBeenCalledWith('/virtual/migrations/002_add_index.sql', 'utf8')
    expect(query.mock.calls).toEqual([
      [
        'CREATE TABLE IF NOT EXISTS schema_migrations (\n  name text PRIMARY KEY,\n  applied_at timestamptz NOT NULL DEFAULT now()\n)'
      ],
      ['SELECT name FROM schema_migrations'],
      ['BEGIN'],
      ['CREATE INDEX idx_subscriptions_email ON subscriptions(email);'],
      ['INSERT INTO schema_migrations(name) VALUES ($1)', ['002_add_index.sql']],
      ['COMMIT']
    ])
    expect(client.release).toHaveBeenCalledTimes(1)
  })
})
