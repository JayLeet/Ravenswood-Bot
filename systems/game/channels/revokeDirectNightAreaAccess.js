const {
  setPermissionOverwritesIfChanged
} = require('../../../utils/discord/permissionOverwriteActions')
const {
  fetchWithRecoverableFallback
} = require('../../../utils/discord/recoverableFetch')
const {
  createBotLogger
} = require('../../../utils/logger')

const log = createBotLogger({ subsystem: 'NightAreaAccess' })

async function revokeDirectNightAreaAccess(guild, game, userId) {
  if (!guild || !game || !userId) return 0

  const channelIds = [...new Set([
    game.nightVoiceChannels?.[userId],
    game.nightChannels?.[userId]
  ].filter(Boolean))]
  let touched = 0

  for (const channelId of channelIds) {
    const channel = await fetchGuildChannel(guild, channelId)
    if (await removePermissionOverwrite(channel, userId)) touched += 1
  }

  return touched
}

async function fetchGuildChannel(guild, channelId) {
  if (!guild || !channelId) return null

  if (typeof guild.channels?.fetch === 'function') {
    const channel = await fetchWithRecoverableFallback({
      action: 'fetch-night-area-channel',
      context: { channelId, guildId: guild.id },
      fetch: () => guild.channels.fetch(channelId),
      logger: log
    })
    if (channel) return channel
  }

  if (typeof guild.channels?.cache?.get === 'function') {
    return guild.channels.cache.get(channelId) || null
  }

  return null
}

async function removePermissionOverwrite(channel, overwriteId) {
  const overwrites = createPermissionOverwritesWithout(channel, overwriteId)
  if (!overwrites) return false

  return setPermissionOverwritesIfChanged(
    channel,
    overwrites,
    'BOTC revoke replaced player cottage access'
  ).catch(err => {
    log.recoverable('revoke-direct-night-area-access', err, {
      channelId: channel?.id,
      guildId: channel?.guildId || channel?.guild?.id,
      userId: overwriteId
    })
    return false
  })
}

function createPermissionOverwritesWithout(channel, overwriteId) {
  const overwrites = getPermissionOverwriteValues(channel)
  if (!overwrites.some(overwrite => String(overwrite?.id) === String(overwriteId))) return null

  return overwrites
    .filter(overwrite => String(overwrite?.id) !== String(overwriteId))
    .map(toPermissionOverwriteOption)
    .filter(Boolean)
}

function getPermissionOverwriteValues(channel) {
  const overwrites = channel?.permissionOverwrites
  if (!overwrites) return []
  if (typeof overwrites.values === 'function') return [...overwrites.values()]
  if (typeof overwrites.cache?.values === 'function') return [...overwrites.cache.values()]
  if (Array.isArray(overwrites.cache)) return overwrites.cache
  if (Array.isArray(overwrites)) return overwrites
  return []
}

function toPermissionOverwriteOption(overwrite) {
  if (!overwrite?.id) return null

  const option = {
    allow: overwrite.allow,
    deny: overwrite.deny,
    id: overwrite.id
  }
  if (overwrite.type !== undefined) option.type = overwrite.type
  return option
}

module.exports = {
  revokeDirectNightAreaAccess
}
