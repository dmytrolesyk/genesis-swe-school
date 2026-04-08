import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Pool, type PoolClient, type QueryResult } from 'pg'

type MigrationFile = {
  isFile: () => boolean
  name: string
}

type MigrationRow = {
  name: string
}

type MigrationClient = Omit<Pick<PoolClient, 'query' | 'release'>, 'release'> & {
  release: () => void
}

type MigrationPool = {
  connect: () => Promise<MigrationClient>
  end?: () => Promise<void>
}

type RunMigrationsOptions = {
  connectionString?: string
  migrationsDir?: string
  pool?: MigrationPool
  readDir?: (
    path: string,
    options: { withFileTypes: true }
  ) => Promise<MigrationFile[]>
  readFile?: (path: string, encoding: BufferEncoding) => Promise<string>
}

const schemaMigrationsSql = `CREATE TABLE IF NOT EXISTS schema_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
)`

const defaultMigrationsDir = fileURLToPath(
  new URL('../../db/migrations', import.meta.url)
)

async function readMigrationFiles (
  migrationsDir: string,
  readDirFn: NonNullable<RunMigrationsOptions['readDir']>
) {
  const entries = await readDirFn(migrationsDir, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort()
}

export async function runMigrations (options: RunMigrationsOptions = {}) {
  const migrationsDir = options.migrationsDir ?? defaultMigrationsDir
  const readDirFn = options.readDir ?? readdir
  const readFileFn = options.readFile ?? readFile
  const pool: MigrationPool = options.pool ?? new Pool({
    connectionString: options.connectionString
  })
  const shouldClosePool = options.pool === undefined
  const client = await pool.connect()

  try {
    await client.query(schemaMigrationsSql)

    const appliedMigrations: QueryResult<MigrationRow> = await client.query(
      'SELECT name FROM schema_migrations'
    )
    const appliedMigrationNames = new Set(
      appliedMigrations.rows.map((migration) => migration.name)
    )
    const migrationFiles = await readMigrationFiles(migrationsDir, readDirFn)
    const pendingMigrationFiles = migrationFiles.filter((migrationFile) => (
      !appliedMigrationNames.has(migrationFile)
    ))

    for (const migrationFile of pendingMigrationFiles) {
      const migrationSql = await readFileFn(join(migrationsDir, migrationFile), 'utf8')

      await client.query('BEGIN')

      try {
        await client.query(migrationSql)
        await client.query(
          'INSERT INTO schema_migrations(name) VALUES ($1)',
          [migrationFile]
        )
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
  } finally {
    client.release()

    if (shouldClosePool) {
      await pool.end?.()
    }
  }
}
