const {
  queuedChannelDelete
} = require('../../../../utils/discord/channelActions')
const {
  isMissingChannelError
} = require('../../../../utils/discord/interactionErrors')
const {
  deletePrivateConversationAccess
} = require('./dayPrivateAccess')

async function cleanupPlayerMadeVoiceChannelRef({
  actionPrefix,
  channelId,
  deleteReason,
  guild,
  logger,
  playerId = null
}) {
  const context = playerId ? { playerId } : {}
  const channel = await fetchCleanupVoiceChannel(guild, channelId, logger, `fetch-${actionPrefix}`, context)
  if (channel.stale) return true
  if (!channel.value) return false

  return deleteCleanupVoiceChannel(channel.value, logger, `delete-${actionPrefix}`, deleteReason, context)
}

async function fetchCleanupVoiceChannel(guild, channelId, logger, action, context = {}) {
  if (!guild?.channels?.fetch) {
    logger?.recoverable?.(`${action}-unavailable`, new Error('Guild channel API unavailable'), {
      guildId: guild?.id,
      channelId,
      ...context
    })
    return { stale: false, value: null }
  }

  return guild.channels.fetch(channelId).then(channel => ({
    stale: !channel,
    value: channel || null
  })).catch(err => {
    if (isMissingChannelError(err)) return { stale: true, value: null }
    logger?.recoverable?.(action, err, {
      guildId: guild.id,
      channelId,
      ...context
    })
    return { stale: false, value: null }
  })
}

async function deleteCleanupVoiceChannel(channel, logger, action, reason, context = {}) {
  return queuedChannelDelete(channel, reason).then(() => true).catch(err => {
    if (isMissingChannelError(err)) return true
    logger?.recoverable?.(action, err, {
      guildId: channel?.guildId || channel?.guild?.id,
      channelId: channel?.id,
      ...context
    })
    return false
  })
}

function clearPlayerMadeVoiceState({ game, gameLifecycle, guildId, playerId }) {
  gameLifecycle.unregisterPlayerMadeVoiceChannel(guildId, playerId)
  deletePrivateConversationAccess(game, playerId)
}

module.exports = {
  cleanupPlayerMadeVoiceChannelRef,
  clearPlayerMadeVoiceState,
  deleteCleanupVoiceChannel
}
