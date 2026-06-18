const {
  queuedChannelSend
} = require('./discord/messageActions')
const {
  createGameLogPayload
} = require('./gameLogSummary')
const {
  createBotLogger
} = require('./logger')

const log = createBotLogger({ subsystem: 'GameLogArchive' })

async function saveGameLogSummary({
  client,
  guildId,
  savedByDisplayName = null,
  savedById = null,
  serverConfigs,
  summary
}) {
  const config = serverConfigs?.get?.(guildId) || {}
  const channelId = config.gameLogChannelId || config.postGameChannelId || config.liveChannelId
  const channel = channelId
    ? await client.channels.fetch(channelId).catch(err => {
        log.recoverable('fetch-game-log-channel', err, {
          channelId,
          guildId,
          summaryId: summary?.id
        })
        return null
      })
    : null

  if (!channel?.isTextBased?.()) {
    return {
      ok: false,
      reason: 'missing-channel',
      message: 'I could not find a channel for saved game logs.'
    }
  }

  const sent = await queuedChannelSend(channel, createGameLogPayload(summary, savedById, {
    savedByDisplayName
  })).catch(err => {
    log.recoverable('send-game-log-summary', err, {
      channelId: channel.id,
      guildId,
      summaryId: summary?.id
    })
    return null
  })

  if (!sent) {
    return {
      ok: false,
      channel,
      reason: 'send-failed',
      message: `I could not post the game log in <#${channel.id}>.`
    }
  }

  return { ok: true, channel, message: sent }
}

module.exports = {
  saveGameLogSummary
}
