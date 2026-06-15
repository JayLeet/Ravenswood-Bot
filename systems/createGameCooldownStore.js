const { getDatabase } = require('./database')
const {
  createBotLogger
} = require('../utils/logger')
const {
  validateCooldownRow
} = require('./persistence/persistedRecordValidation')

const log = createBotLogger({ subsystem: 'CreateGameCooldownStore' })

function loadCreateGameCooldowns(now = Date.now()) {
  try {
    pruneCreateGameCooldowns(now)
    const rows = getDatabase()
      .prepare('SELECT guild_id, user_id, expires_at FROM create_game_cooldowns')
      .all()
    return new Map(rows
      .map(row => validateCooldownRow(row, { logger: log }))
      .filter(Boolean)
      .map(row => [`${row.guildId}:${row.userId}`, row.expiresAt]))
  } catch (err) {
    log.error('load-cooldowns', err)
    return new Map()
  }
}

function saveCreateGameCooldown(guildId, userId, expiresAt) {
  try {
    getDatabase().prepare(`
      INSERT INTO create_game_cooldowns (guild_id, user_id, expires_at, updated_at)
      VALUES (@guildId, @userId, @expiresAt, CURRENT_TIMESTAMP)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET
        expires_at = excluded.expires_at,
        updated_at = CURRENT_TIMESTAMP
    `).run({ guildId, userId, expiresAt })
  } catch (err) {
    log.error('save-cooldown', err, { guildId, userId })
  }
}

function pruneCreateGameCooldowns(now = Date.now()) {
  try {
    return getDatabase()
      .prepare('DELETE FROM create_game_cooldowns WHERE expires_at <= ?')
      .run(now).changes
  } catch (err) {
    log.error('prune-cooldowns', err)
    return 0
  }
}

module.exports = {
  loadCreateGameCooldowns,
  pruneCreateGameCooldowns,
  saveCreateGameCooldown
}
