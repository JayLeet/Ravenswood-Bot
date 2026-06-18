const {
  AuditLogEvent
} = require('discord.js')
const {
  getBotUserId
} = require('./discord/botIdentity')
const {
  getSetupCleanupFallbackStartedAt,
  isAutoSetupCleanupFallbackActive
} = require('./setupCleanupFallback')
const {
  logSetupRecoverable
} = require('./setupLogging')

async function fetchFallbackBotCreatedChannelIds(guild, serverConfig = {}) {
  if (!isAutoSetupCleanupFallbackActive(serverConfig)) return new Set()
  const startedAt = getSetupCleanupFallbackStartedAt(serverConfig)
  const botId = getBotUserId(guild)
  if (!startedAt || !botId || typeof guild?.fetchAuditLogs !== 'function') return new Set()

  return guild.fetchAuditLogs({ type: AuditLogEvent.ChannelCreate, limit: 100 })
    .then(logs => collectBotCreatedChannelIds(logs, botId, startedAt))
    .catch(err => {
      logSetupRecoverable('fetch-setup-delete-channel-create-audit-log', err, { guildId: guild?.id }, false)
      return new Set()
    })
}

function collectBotCreatedChannelIds(logs, botId, startedAt) {
  const ids = new Set()
  for (const entry of getAuditEntries(logs)) {
    if (getAuditExecutorId(entry) !== botId) continue
    if (getAuditCreatedTimestamp(entry) < startedAt) continue
    const targetId = getAuditTargetId(entry)
    if (targetId) ids.add(String(targetId))
  }
  return ids
}

function getAuditEntries(logs) {
  const entries = logs?.entries
  if (!entries) return []
  if (Array.isArray(entries)) return entries
  if (typeof entries.values === 'function') return [...entries.values()]
  if (typeof entries[Symbol.iterator] === 'function') return [...entries]
  return Object.values(entries)
}

function getAuditExecutorId(entry) {
  return String(entry?.executorId || entry?.executor?.id || '')
}

function getAuditTargetId(entry) {
  return String(entry?.targetId || entry?.target?.id || '')
}

function getAuditCreatedTimestamp(entry) {
  const timestamp = Number(entry?.createdTimestamp)
  return Number.isFinite(timestamp) ? timestamp : 0
}

module.exports = {
  collectBotCreatedChannelIds,
  fetchFallbackBotCreatedChannelIds
}
