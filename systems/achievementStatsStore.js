const { getDatabase } = require('./database')
const {
  createAchievementDeltas,
  mergeAchievementStats
} = require('./game/history/AchievementStats')
const {
  createBotLogger
} = require('../utils/logger')
const {
  validateAchievementStats
} = require('./persistence/persistedRecordValidation')

const log = createBotLogger({ subsystem: 'AchievementStatsStore' })

function updateAchievementStats(summary) {
  if (!summary?.guildId) return false

  try {
    const db = getDatabase()
    const deltas = createAchievementDeltas(summary)
    const select = db.prepare(`
      SELECT data
      FROM achievement_stats
      WHERE guild_id = ? AND user_id = ?
    `)
    const upsert = db.prepare(`
      INSERT INTO achievement_stats (guild_id, user_id, data, updated_at)
      VALUES (@guildId, @userId, @data, CURRENT_TIMESTAMP)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET
        data = excluded.data,
        updated_at = CURRENT_TIMESTAMP
    `)

    const save = db.transaction(() => {
      for (const [userId, delta] of Object.entries(deltas)) {
        const existingData = select.get(summary.guildId, userId)?.data
        const existingParsed = existingData ? parseJson(existingData) : null
        const existing = existingParsed
          ? validateAchievementStats(existingParsed, {
            guildId: summary.guildId,
            logger: log,
            userId
          })
          : null
        const next = mergeAchievementStats(existing || { userId }, { ...delta, userId })
        upsert.run({
          guildId: summary.guildId,
          userId,
          data: JSON.stringify(next)
        })
      }
    })

    save()
    return true
  } catch (err) {
    log.error('save-achievement-stats', err, { guildId: summary.guildId })
    return false
  }
}

function parseJson(raw) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (err) {
    log.error('parse-json', err)
    return null
  }
}

module.exports = {
  updateAchievementStats
}
