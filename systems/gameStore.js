const fs = require('node:fs')
const { getDatabase } = require('./database')
const {
  createBotLogger
} = require('../utils/logger')
const {
  validatePersistedGame
} = require('./persistence/persistedRecordValidation')

const LEGACY_PATH = './games.json'
const log = createBotLogger({ subsystem: 'GameStore' })

function loadGames() {
  try {
    const db = getDatabase()
    migrateGamesFromJsonIfNeeded(db)

    const rows = db
      .prepare('SELECT guild_id, data FROM games')
      .all()

    const map = new Map()

    for (const row of rows) {
      const game = parseJson(row.data, `[GAME LOAD FAIL] ${row.guild_id}`)
      if (!game) continue

      const validated = validatePersistedGame(game, { guildId: row.guild_id, logger: log })
      if (!validated) continue

      map.set(row.guild_id, normalizeGame(validated))
    }

    return map
  } catch (err) {
    log.error('load-games', err)
    return new Map()
  }
}

function saveGames(games) {
  try {
    const db = getDatabase()
    const guildIds = [...games.keys()]

    const deleteMissing = db.prepare(`
      DELETE FROM games
      WHERE guild_id NOT IN (${guildIds.map(() => '?').join(',') || "''"})
    `)
    const upsert = db.prepare(`
      INSERT INTO games (guild_id, data, updated_at)
      VALUES (@guildId, @data, CURRENT_TIMESTAMP)
      ON CONFLICT(guild_id) DO UPDATE SET
        data = excluded.data,
        updated_at = CURRENT_TIMESTAMP
    `)

    const save = db.transaction(() => {
      if (guildIds.length) deleteMissing.run(...guildIds)
      else db.prepare('DELETE FROM games').run()

      for (const [guildId, game] of games.entries()) {
        const validated = validatePersistedGame(game, { guildId, logger: log })
        if (!validated) continue

        upsert.run({
          guildId,
          data: JSON.stringify(normalizeGame(validated))
        })
      }
    })

    save()
  } catch (err) {
    log.error('save-games', err)
  }
}

function migrateGamesFromJsonIfNeeded(db) {
  const existing = db.prepare('SELECT COUNT(*) AS count FROM games').get()
  if (existing.count > 0) return
  if (!fs.existsSync(LEGACY_PATH)) return

  const raw = fs.readFileSync(LEGACY_PATH, 'utf8')
  const data = parseJson(raw, '[GAME MIGRATION LOAD FAIL]')
  if (!data || typeof data !== 'object') return

  const entries = Object.entries(data)
  if (!entries.length) return

  const insert = db.prepare(`
    INSERT OR IGNORE INTO games (guild_id, data, updated_at)
    VALUES (@guildId, @data, CURRENT_TIMESTAMP)
  `)

  const migrate = db.transaction(() => {
    for (const [guildId, game] of entries) {
      const validated = validatePersistedGame(game, { guildId, logger: log })
      if (!validated) continue

      insert.run({
        guildId,
        data: JSON.stringify(normalizeGame(validated))
      })
    }
  })

  migrate()
}

function normalizeGame(game) {
  return {
    ...game,
    users: game.users || {},
    requests: game.requests || [],
    messages: game.messages || [],
    state: game.state || 'lobby',
    maxPlayers: game.maxPlayers || 15,
    phaseHistory: game.phaseHistory || [],
    pendingWin: game.pendingWin || null,
    pendingEndReveal: game.pendingEndReveal || null,
    pendingManualImpReplacement: game.pendingManualImpReplacement || null,
    paused: game.paused || null,
    replacementSlot: game.replacementSlot || null,
    nominations: game.nominations || [],
    nominationRequests: game.nominationRequests || [],
    nightActions: game.nightActions || [],
    executionHistory: game.executionHistory || [],
    executedPlayer: game.executedPlayer ?? null,
    executionCandidate: game.executionCandidate ?? null,
    executionShields: game.executionShields || {},
    nightAreaSlots: game.nightAreaSlots || {},
    nightCottageStatusMessages: game.nightCottageStatusMessages || {},
    nightInfoPromptMessages: game.nightInfoPromptMessages || {},
    nightInfoNoticeMessages: game.nightInfoNoticeMessages || {},
    pendingNightDeaths: game.pendingNightDeaths || [],
    nightChannels: game.nightChannels || {},
    nightOptions: game.nightOptions || {},
    nightPromptMessages: game.nightPromptMessages || {},
    nightVoiceChannels: game.nightVoiceChannels || {},
    pendingRoleInfoUpdates: game.pendingRoleInfoUpdates || {},
    storytellerDenChannelId: game.storytellerDenChannelId || null,
    townsquareChannelId: game.townsquareChannelId || null,
    privateConversationCreatorChannelId: game.privateConversationCreatorChannelId || null,
    playerMadeVoiceChannels: game.playerMadeVoiceChannels || {},
    playerMadeVoiceAccess: game.playerMadeVoiceAccess || {},
    publicDaySideChannelIds: game.publicDaySideChannelIds || {},
    votes: game.votes || [],
    deadVotes: game.deadVotes || {},
    demonNotInPlayRoles: game.demonNotInPlayRoles || {},
    zombuulDeaths: game.zombuulDeaths || {},
    roles: game.roles || {},
    shownRoles: game.shownRoles || {},
    lunaticInfo: game.lunaticInfo || {},
    roleHistory: game.roleHistory || {},
    roleCategories: game.roleCategories || {},
    roleInfoPromptMessages: game.roleInfoPromptMessages || {},
    roleInfoSent: game.roleInfoSent || {},
    playerGrimoires: game.playerGrimoires || {},
    reminders: game.reminders || [],
    statusEffects: game.statusEffects || {},
    storytellerMoveRequests: game.storytellerMoveRequests || {},
    substituteBriefings: game.substituteBriefings || {}
  }
}

function parseJson(raw, label) {
  try {
    return JSON.parse(raw)
  } catch (err) {
    log.error('parse-json', err, { label })
    return null
  }
}

module.exports = { loadGames, saveGames }
