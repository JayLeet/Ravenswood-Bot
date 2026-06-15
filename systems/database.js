const path = require('node:path')
const Database = require('better-sqlite3')
const {
  createBotLogger
} = require('../utils/logger')

const DB_PATH = process.env.BOTC_DB_PATH || path.join(process.cwd(), 'botc.sqlite')
const DATABASE_SCHEMA_VERSION = 1
const DATABASE_REQUIRED_TABLES = Object.freeze([
  'achievement_stats',
  'create_game_cooldowns',
  'games',
  'pending_game_summaries',
  'server_configs'
])
const DATABASE_REQUIRED_COLUMNS = Object.freeze({
  achievement_stats: Object.freeze(['guild_id', 'user_id', 'data', 'updated_at']),
  create_game_cooldowns: Object.freeze(['guild_id', 'user_id', 'expires_at', 'updated_at']),
  games: Object.freeze(['guild_id', 'data', 'updated_at']),
  pending_game_summaries: Object.freeze(['guild_id', 'data', 'created_at', 'expires_at']),
  server_configs: Object.freeze(['guild_id', 'data', 'updated_at'])
})
const DATABASE_REQUIRED_PRIMARY_KEYS = Object.freeze({
  achievement_stats: Object.freeze(['guild_id', 'user_id']),
  create_game_cooldowns: Object.freeze(['guild_id', 'user_id']),
  games: Object.freeze(['guild_id']),
  pending_game_summaries: Object.freeze(['guild_id']),
  server_configs: Object.freeze(['guild_id'])
})
const log = createBotLogger({ subsystem: 'Database' })

let db = null

function getDatabase() {
  if (db) return db

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')
  db.pragma('busy_timeout = 5000')

  initializeDatabase(db)
  markSchemaVersion(db)
  validateDatabaseSchema(db)

  return db
}

function optimizeDatabase() {
  try {
    getDatabase().pragma('optimize')
    return true
  } catch (err) {
    log.recoverable('optimize-database', err)
    return false
  }
}

function initializeDatabase(database) {
  database.exec(`
    DROP INDEX IF EXISTS idx_game_sessions_guild_id_created_at;
    DROP TABLE IF EXISTS game_sessions;

    CREATE TABLE IF NOT EXISTS games (
      guild_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS server_configs (
      guild_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS achievement_stats (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS pending_game_summaries (
      guild_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS create_game_cooldowns (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (guild_id, user_id)
    );
  `)
}

function getSchemaVersion(database = getDatabase()) {
  return Number(database.pragma('user_version', { simple: true }) || 0)
}

function markSchemaVersion(database) {
  const current = getSchemaVersion(database)
  if (current >= DATABASE_SCHEMA_VERSION) return current
  database.pragma(`user_version = ${DATABASE_SCHEMA_VERSION}`)
  return DATABASE_SCHEMA_VERSION
}

function validateDatabaseSchema(database = getDatabase()) {
  const rows = database.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
  `).all()
  const existing = new Set(rows.map(row => row.name))
  const missing = DATABASE_REQUIRED_TABLES.filter(table => !existing.has(table))
  if (missing.length) {
    throw new Error(`Missing database tables: ${missing.join(', ')}`)
  }

  const missingColumns = getMissingRequiredColumns(database)
  const missingColumnList = Object.entries(missingColumns)
    .flatMap(([table, columns]) => columns.map(column => `${table}.${column}`))
  if (missingColumnList.length) {
    throw new Error(`Missing database columns: ${missingColumnList.join(', ')}`)
  }

  const invalidPrimaryKeys = getInvalidRequiredPrimaryKeys(database)
  const invalidPrimaryKeyList = Object.entries(invalidPrimaryKeys)
    .map(([table, keys]) => `${table} expected ${keys.expected.join(', ')}, got ${keys.actual.join(', ') || 'none'}`)
  if (invalidPrimaryKeyList.length) {
    throw new Error(`Invalid database primary keys: ${invalidPrimaryKeyList.join('; ')}`)
  }

  return {
    columns: DATABASE_REQUIRED_COLUMNS,
    missing,
    missingColumns,
    tables: DATABASE_REQUIRED_TABLES.filter(table => existing.has(table))
  }
}

function getMissingRequiredColumns(database) {
  const missingColumns = {}

  for (const [table, requiredColumns] of Object.entries(DATABASE_REQUIRED_COLUMNS)) {
    const rows = database.pragma(`table_info(${table})`) || []
    const existingColumns = new Set(rows.map(row => row.name))
    const missing = requiredColumns.filter(column => !existingColumns.has(column))
    if (missing.length) missingColumns[table] = missing
  }

  return missingColumns
}

function getInvalidRequiredPrimaryKeys(database) {
  const invalidPrimaryKeys = {}

  for (const [table, requiredPrimaryKeys] of Object.entries(DATABASE_REQUIRED_PRIMARY_KEYS)) {
    const rows = database.pragma(`table_info(${table})`) || []
    if (!rows.some(row => Object.prototype.hasOwnProperty.call(row, 'pk'))) continue

    const actual = rows
      .filter(row => Number(row.pk) > 0)
      .sort((a, b) => Number(a.pk) - Number(b.pk))
      .map(row => row.name)

    if (!sameStringList(actual, requiredPrimaryKeys)) {
      invalidPrimaryKeys[table] = {
        actual,
        expected: requiredPrimaryKeys
      }
    }
  }

  return invalidPrimaryKeys
}

function sameStringList(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

module.exports = {
  DATABASE_REQUIRED_COLUMNS,
  DATABASE_REQUIRED_TABLES,
  DATABASE_SCHEMA_VERSION,
  getSchemaVersion,
  getDatabase,
  getMissingRequiredColumns,
  markSchemaVersion,
  optimizeDatabase,
  validateDatabaseSchema
}
