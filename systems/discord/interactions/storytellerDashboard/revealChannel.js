const {
  createBotLogger
} = require('../../../../utils/logger')

const log = createBotLogger({ subsystem: 'PostGameRevealChannel' })

async function getPostGameRevealChannel(discordClient, serverConfig) {
  const channelIds = [
    serverConfig?.postGameChannelId,
    serverConfig?.liveChannelId
  ].filter(Boolean)

  for (const channelId of channelIds) {
    if (!discordClient?.channels?.fetch) {
      log.recoverable('fetch-post-game-reveal-channel-unavailable', new Error('Discord client channel API unavailable'), { channelId })
      return null
    }

    const channel = await discordClient.channels.fetch(channelId).catch(err => {
      log.recoverable('fetch-post-game-reveal-channel', err, { channelId })
      return null
    })
    if (channel?.isTextBased?.()) return channel
  }

  return null
}

module.exports = {
  getPostGameRevealChannel
}
