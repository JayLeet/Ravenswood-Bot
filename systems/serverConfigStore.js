const fs = require('node:fs')
const { getDatabase } = require('./database')
const {
  createBotLogger
} = require('../utils/logger')
const {
  validatePersistedServerConfig
} = require('./persistence/persistedRecordValidation')

const LEGACY_PATH = './server-configs.json'
const log = createBotLogger({ subsystem: 'ServerConfigStore' })

function loadServerConfigs() {
  try {
    const db = getDatabase()
    migrateServerConfigsFromJsonIfNeeded(db)

    const rows = db
      .prepare('SELECT guild_id, data FROM server_configs')
      .all()

    const map = new Map()

    for (const row of rows) {
      const config = parseJson(row.data, `[CONFIG LOAD FAIL] ${row.guild_id}`)
      if (!config) continue

      const validated = validatePersistedServerConfig(config, { guildId: row.guild_id, logger: log })
      if (!validated) continue

      map.set(row.guild_id, validated)
    }

    return map
  } catch (err) {
    log.error('load-server-configs', err)
    return new Map()
  }
}

function saveServerConfigs(configs) {
  try {
    const db = getDatabase()
    const guildIds = [...configs.keys()]

    const deleteMissing = db.prepare(`
      DELETE FROM server_configs
      WHERE guild_id NOT IN (${guildIds.map(() => '?').join(',') || "''"})
    `)
    const upsert = db.prepare(`
      INSERT INTO server_configs (guild_id, data, updated_at)
      VALUES (@guildId, @data, CURRENT_TIMESTAMP)
      ON CONFLICT(guild_id) DO UPDATE SET
        data = excluded.data,
        updated_at = CURRENT_TIMESTAMP
    `)

    const save = db.transaction(() => {
      if (guildIds.length) deleteMissing.run(...guildIds)
      else db.prepare('DELETE FROM server_configs').run()

      for (const [guildId, config] of configs.entries()) {
        const validated = validatePersistedServerConfig(config, { guildId, logger: log })
        if (!validated) continue

        upsert.run({
          guildId,
          data: JSON.stringify(validated)
        })
      }
    })

    save()
  } catch (err) {
    log.error('save-server-configs', err)
  }
}

function migrateServerConfigsFromJsonIfNeeded(db) {
  const existing = db.prepare('SELECT COUNT(*) AS count FROM server_configs').get()
  if (existing.count > 0) return
  if (!fs.existsSync(LEGACY_PATH)) return

  const raw = fs.readFileSync(LEGACY_PATH, 'utf8')
  const data = parseJson(raw, '[CONFIG MIGRATION LOAD FAIL]')
  if (!data || typeof data !== 'object') return

  const entries = Object.entries(data)
  if (!entries.length) return

  const insert = db.prepare(`
    INSERT OR IGNORE INTO server_configs (guild_id, data, updated_at)
    VALUES (@guildId, @data, CURRENT_TIMESTAMP)
  `)

  const migrate = db.transaction(() => {
    for (const [guildId, config] of entries) {
      const validated = validatePersistedServerConfig(config, { guildId, logger: log })
      if (!validated) continue

      insert.run({
        guildId,
        data: JSON.stringify(validated)
      })
    }
  })

  migrate()
}

function parseJson(raw, label) {
  try {
    return JSON.parse(raw)
  } catch (err) {
    log.error('parse-json', err, { label })
    return null
  }
}

module.exports = { loadServerConfigs, saveServerConfigs }
