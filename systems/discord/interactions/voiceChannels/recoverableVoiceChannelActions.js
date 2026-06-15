const {
  setChannelNameIfChanged,
  setChannelParentIfChanged
} = require('../../../../utils/discord/channelState')
const {
  setPermissionOverwritesIfChanged
} = require('../../../../utils/discord/permissionOverwriteActions')

async function fetchVoiceChannel(guild, channelId, logger, action, context = {}) {
  if (!guild?.channels?.fetch) {
    logger?.recoverable?.(`${action}-unavailable`, new Error('Guild channel API unavailable'), {
      guildId: guild?.id,
      channelId,
      ...context
    })
    return null
  }

  return guild.channels.fetch(channelId).catch(err => {
    logger?.recoverable?.(action, err, {
      guildId: guild.id,
      channelId,
      ...context
    })
    return null
  })
}

async function refreshVoiceChannel(channel, name, parent, overwrites, reason, logger) {
  await setPermissionOverwritesIfChanged(channel, overwrites, reason).catch(err => {
    logger?.recoverable?.('refresh-private-voice-permissions', err, createChannelContext(channel))
  })
  await setChannelNameIfChanged(channel, name, reason).catch(err => {
    logger?.recoverable?.('refresh-private-voice-name', err, createChannelContext(channel))
  })
  await setChannelParentIfChanged(channel, parent?.id || null, { lockPermissions: false }).catch(err => {
    logger?.recoverable?.('refresh-private-voice-parent', err, {
      ...createChannelContext(channel),
      parentId: parent?.id || null
    })
  })
}

function createChannelContext(channel) {
  return {
    guildId: channel?.guildId || channel?.guild?.id,
    channelId: channel?.id
  }
}

module.exports = {
  fetchVoiceChannel,
  refreshVoiceChannel
}
