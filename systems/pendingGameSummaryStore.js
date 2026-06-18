const { getDatabase } = require('./database')
const {
  createBotLogger
} = require('../utils/logger')
const {
  validatePendingGameSummary
} = require('./persistence/persistedRecordValidation')

const DEFAULT_PENDING_SUMMARY_TTL_MS = 72 * 60 * 60 * 1000
const log = createBotLogger({ subsystem: 'PendingGameSummaryStore' })

function savePendingGameSummary(summary, options = {}) {
  if (!summary?.guildId) return false

  const expiresAt = options.expiresAt || Date.now() + DEFAULT_PENDING_SUMMARY_TTL_MS
  const data = validatePendingGameSummary({ ...summary, expiresAt }, { guildId: summary.guildId, logger: log })
  if (!data) return false

  try {
    getDatabase().prepare(`
      INSERT INTO pending_game_summaries (guild_id, data, created_at, expires_at)
      VALUES (@guildId, @data, CURRENT_TIMESTAMP, @expiresAt)
      ON CONFLICT(guild_id) DO UPDATE SET
        data = excluded.data,
        created_at = CURRENT_TIMESTAMP,
        expires_at = excluded.expires_at
    `).run({
      guildId: summary.guildId,
      data: JSON.stringify(data),
      expiresAt
    })
    return data
  } catch (err) {
    log.error('save-pending-summary', err, { guildId: summary.guildId })
    return false
  }
}

function loadPendingGameSummary(guildId, now = Date.now()) {
  try {
    const row = getDatabase()
      .prepare('SELECT data, expires_at FROM pending_game_summaries WHERE guild_id = ?')
      .get(guildId)
    if (!row) return null

    if (Number(row.expires_at) <= now) {
      deletePendingGameSummary(guildId)
      return null
    }

    const summary = parseJson(row.data)
    if (!summary) return null

    return validatePendingGameSummary(summary, { guildId, logger: log })
  } catch (err) {
    log.error('load-pending-summary', err, { guildId })
    return null
  }
}

function deletePendingGameSummary(guildId) {
  try {
    getDatabase()
      .prepare('DELETE FROM pending_game_summaries WHERE guild_id = ?')
      .run(guildId)
    return true
  } catch (err) {
    log.error('delete-pending-summary', err, { guildId })
    return false
  }
}

function deleteExpiredPendingGameSummaries(now = Date.now()) {
  try {
    const result = getDatabase()
      .prepare('DELETE FROM pending_game_summaries WHERE expires_at <= ?')
      .run(now)
    return result.changes || 0
  } catch (err) {
    log.error('prune-pending-summaries', err)
    return 0
  }
}

function deletePendingGameSummariesNotInGuilds(activeGuildIds = []) {
  const guildIds = [...new Set(activeGuildIds.filter(Boolean).map(String))]

  try {
    const sql = guildIds.length
      ? `DELETE FROM pending_game_summaries WHERE guild_id NOT IN (${guildIds.map(() => '?').join(', ')})`
      : 'DELETE FROM pending_game_summaries'
    const result = getDatabase().prepare(sql).run(...guildIds)
    return result.changes || 0
  } catch (err) {
    log.error('prune-left-guild-pending-summaries', err, { guildCount: guildIds.length })
    return 0
  }
}

function parseJson(raw) {
  try {
    return JSON.parse(raw)
  } catch (err) {
    log.error('parse-json', err)
    return null
  }
}

module.exports = {
  DEFAULT_PENDING_SUMMARY_TTL_MS,
  deleteExpiredPendingGameSummaries,
  deletePendingGameSummariesNotInGuilds,
  deletePendingGameSummary,
  loadPendingGameSummary,
  savePendingGameSummary
}
