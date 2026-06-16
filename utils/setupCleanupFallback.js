const {
  AUTO_SETUP_CATEGORY_NAME,
  AUTO_SETUP_CHANNELS,
  AUTO_SETUP_GAME_LOG_CHANNEL,
  BOT_UPDATE_CHANNEL_NAME
} = require('./setupAutoChannels')
const {
  SETUP_SHARED_VOICE_CHANNELS
} = require('./setupVoiceChannels')
const {
  RESERVED_NIGHT_AREA_CATEGORY_NAME,
  RESERVED_NIGHT_VOICE_NAME
} = require('../systems/discord/interactions/nightArea/reservedChannels')

const SETUP_CLEANUP_FALLBACK_AUTO = 'auto-setup'
const SETUP_CLEANUP_FALLBACK_MODE_FIELD = 'setupCleanupFallbackMode'
const SETUP_CLEANUP_FALLBACK_STARTED_AT_FIELD = 'setupCleanupFallbackStartedAt'

const MAIN_SETUP_CHANNEL_NAMES = new Set([
  ...Object.values(AUTO_SETUP_CHANNELS).map(config => config.name),
  AUTO_SETUP_GAME_LOG_CHANNEL.name,
  BOT_UPDATE_CHANNEL_NAME,
  ...SETUP_SHARED_VOICE_CHANNELS.map(config => config.name)
])
const COTTAGE_SETUP_CHANNEL_NAMES = new Set([RESERVED_NIGHT_VOICE_NAME])
const SETUP_CATEGORY_NAMES = new Set([
  AUTO_SETUP_CATEGORY_NAME,
  RESERVED_NIGHT_AREA_CATEGORY_NAME
])

function beginSetupCleanupFallback(interaction, context = {}, mode = SETUP_CLEANUP_FALLBACK_AUTO) {
  const guildId = interaction.guild?.id
  if (!guildId || !context.serverConfigs?.set || !context.saveServerConfigs) return

  const previous = context.serverConfigs.get(guildId) || {}
  context.serverConfigs.set(guildId, {
    ...previous,
    [SETUP_CLEANUP_FALLBACK_MODE_FIELD]: mode,
    [SETUP_CLEANUP_FALLBACK_STARTED_AT_FIELD]: new Date().toISOString()
  })
  context.saveServerConfigs(context.serverConfigs)
}

function isAutoSetupCleanupFallbackActive(serverConfig = {}) {
  return serverConfig[SETUP_CLEANUP_FALLBACK_MODE_FIELD] === SETUP_CLEANUP_FALLBACK_AUTO
}

function getSetupCleanupFallbackStartedAt(serverConfig = {}) {
  const timestamp = Date.parse(serverConfig[SETUP_CLEANUP_FALLBACK_STARTED_AT_FIELD] || '')
  return Number.isFinite(timestamp) ? timestamp : null
}

function shouldFallbackDeleteCategory(category, serverConfig = {}) {
  if (!isAutoSetupCleanupFallbackActive(serverConfig)) return false
  if (!SETUP_CATEGORY_NAMES.has(category?.name)) return false
  return wasCreatedAfterFallbackStarted(category, serverConfig)
}

function shouldFallbackDeleteChannel(channel, parentCategory, serverConfig = {}) {
  if (!isAutoSetupCleanupFallbackActive(serverConfig)) return false
  if (!wasCreatedAfterFallbackStarted(channel, serverConfig)) return false

  if (parentCategory?.name === AUTO_SETUP_CATEGORY_NAME) {
    return MAIN_SETUP_CHANNEL_NAMES.has(channel?.name)
  }
  if (parentCategory?.name === RESERVED_NIGHT_AREA_CATEGORY_NAME) {
    return COTTAGE_SETUP_CHANNEL_NAMES.has(channel?.name)
  }
  return false
}

function wasCreatedAfterFallbackStarted(item, serverConfig = {}) {
  const startedAt = getSetupCleanupFallbackStartedAt(serverConfig)
  if (!startedAt) return false
  const createdAt = Number(item?.createdTimestamp)
  return Number.isFinite(createdAt) && createdAt >= startedAt
}

function clearSetupCleanupFallback(config = {}) {
  const next = { ...config }
  delete next[SETUP_CLEANUP_FALLBACK_MODE_FIELD]
  delete next[SETUP_CLEANUP_FALLBACK_STARTED_AT_FIELD]
  return next
}

module.exports = {
  SETUP_CLEANUP_FALLBACK_AUTO,
  SETUP_CLEANUP_FALLBACK_MODE_FIELD,
  SETUP_CLEANUP_FALLBACK_STARTED_AT_FIELD,
  beginSetupCleanupFallback,
  clearSetupCleanupFallback,
  getSetupCleanupFallbackStartedAt,
  isAutoSetupCleanupFallbackActive,
  shouldFallbackDeleteCategory,
  shouldFallbackDeleteChannel
}
