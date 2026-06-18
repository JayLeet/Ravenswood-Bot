const { formatUserIds } = require('./gameLogUserIds')
const {
  formatPlainUser
} = require('./gameLogTextFormat')

function formatModerationDetails(summary, savedById = null) {
  return [
    `Server ID: ${summary.guildId || 'unknown'}`,
    '',
    'User IDs',
    formatUserIds(summary, savedById),
    '',
    'Bot message links',
    formatTrackedMessages(summary),
    '',
    'Voice channel refs',
    formatVoiceRefs(summary)
  ].join('\n')
}

function formatTrackedMessages(summary) {
  const messages = summary.messages || []
  if (!messages.length) return 'No tracked bot messages recorded.'
  return messages.map(ref => {
    const link = summary.guildId && ref.channelId && ref.messageId
      ? `https://discord.com/channels/${summary.guildId}/${ref.channelId}/${ref.messageId}`
      : null
    return [
      `Channel ID: ${ref.channelId || 'unknown'}`,
      `Message ID: ${ref.messageId || 'unknown'}`,
      link
    ].filter(Boolean).join(' - ')
  }).join('\n')
}

function formatVoiceRefs(summary) {
  const refs = Object.entries(summary.nightVoiceChannels || {})
  const special = [
    summary.storytellerDenChannelId ? `Storyteller Den channel ID: ${summary.storytellerDenChannelId}` : null,
    summary.townsquareChannelId ? `Townsquare channel ID: ${summary.townsquareChannelId}` : null
  ].filter(Boolean)
  const playerRefs = refs.map(([playerId, channelId]) => `${formatPlainUser(summary, playerId)} channel ID: ${channelId}`)
  return [...special, ...playerRefs].join('\n') || 'No voice channel refs recorded.'
}

module.exports = {
  formatModerationDetails
}
