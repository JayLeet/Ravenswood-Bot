const {
  ChannelType
} = require('discord.js')
const {
  getReusablePromptRef
} = require('../nightPromptMessages')

async function pruneMissingNightChannels({ game, gameLifecycle, guild, logger = null }) {
  for (const [playerId, channelId] of Object.entries(game.nightChannels || {})) {
    const result = await fetchNightChannel(guild, channelId, { logger, playerId })
    if (result.keep) continue
    gameLifecycle.unregisterNightChannel(guild.id, playerId)
  }
}

async function fetchNightChannel(guild, channelId, { logger = null, playerId = null } = {}) {
  try {
    const channel = await guild.channels.fetch(channelId)
    return {
      channel,
      keep: isUsableNightPromptChannel(channel)
    }
  } catch (err) {
    if (isMissingChannelError(err)) return { channel: null, keep: false }

    logger?.recoverable?.('fetch-night-channel-for-recovery-prune', err, {
      channelId,
      guildId: guild?.id,
      playerId
    })
    return { channel: null, keep: true }
  }
}

function isUsableNightPromptChannel(channel) {
  return Boolean(channel?.isTextBased?.() || channel?.type === ChannelType.GuildVoice)
}

function isMissingChannelError(err) {
  const code = err?.code ?? err?.rawError?.code
  const message = String(err?.rawError?.message || err?.message || '').toLowerCase()
  return code === 10003 || message.includes('unknown channel')
}

function shouldRecoverNightActionPrompt(game, action, actorId) {
  if (action.promptChannelId && action.promptMessageId) return true
  if (action.autoPrompt === true) return true

  const storedRef = getReusablePromptRef(game, actorId, action)
  return Boolean(storedRef?.channelId && storedRef?.messageId)
}

module.exports = {
  isMissingChannelError,
  pruneMissingNightChannels,
  shouldRecoverNightActionPrompt
}
