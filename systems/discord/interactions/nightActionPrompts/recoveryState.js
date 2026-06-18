const {
  ChannelType
} = require('discord.js')
const {
  getReusablePromptRef
} = require('../nightPromptMessages')
const {
  isMissingChannelError
} = require('../../../../utils/discord/interactionErrors')

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

function shouldRecoverNightActionPrompt(game, action, actorId) {
  if (shouldSkipRecoveredFirstNightInfo(game, action, actorId)) return false
  if (action.promptChannelId && action.promptMessageId) return true
  if (action.autoPrompt === true) return true

  const storedRef = getReusablePromptRef(game, actorId, action)
  return Boolean(storedRef?.channelId && storedRef?.messageId)
}

function shouldSkipRecoveredFirstNightInfo(game, action, actorId) {
  if (!isFirstNightInfoAction(action)) return false
  if (action?.purpose === 'role_change_info') return false
  return Boolean(game?.roleInfoPromptMessages?.[actorId] || game?.roleInfoSent?.[actorId])
}

function isFirstNightInfoAction(action) {
  return action?.firstNightRoleInfo === true ||
    action?.purpose === 'first_night_info' ||
    action?.purpose === 'starting_role_info'
}

module.exports = {
  pruneMissingNightChannels,
  shouldSkipRecoveredFirstNightInfo,
  shouldRecoverNightActionPrompt
}
