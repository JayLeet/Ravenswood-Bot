const {
  queuedMessageDelete
} = require('../../../../utils/discord/messageActions')
const {
  fetchStatusMessageState,
  logStatusDeleteFailure
} = require('./statusMessageRefs')

const DELETE_UNAVAILABLE = Symbol('delete-unavailable')

async function deleteNightOrderGuidanceMessage(interaction, context, deps = {}) {
  const serverConfig = context.serverConfig || deps.serverConfigs?.get?.(interaction.guild.id)
  const messageId = serverConfig?.storytellerNightOrderGuidanceMessageId
  if (!serverConfig) return null

  const fetched = messageId
    ? await fetchStatusMessageState(interaction.channel, messageId, {
      guildId: interaction.guild.id,
      subsystem: 'NightOrderGuidance'
    })
    : { message: null, unavailable: false }
  if (fetched.unavailable) return null
  const message = fetched.message || getClickedNightOrderGuidanceMessage(interaction, messageId)
  if (message && await deleteGuidanceMessage(message, interaction.guild.id, messageId || message.id) === DELETE_UNAVAILABLE) return null

  delete serverConfig.storytellerNightOrderGuidanceMessageId
  deps.serverConfigs?.set?.(interaction.guild.id, serverConfig)
  deps.saveServerConfigs?.(deps.serverConfigs)
  return null
}

function getClickedNightOrderGuidanceMessage(interaction, messageId) {
  const message = interaction?.message
  if (!message) return null
  if (messageId && message.id !== messageId) return null
  return messageHasEmbedTitle(message, 'Night Order Guidance') ? message : null
}

function messageHasEmbedTitle(message, title) {
  return (message.embeds || []).some(embed => (embed?.data?.title || embed?.title) === title)
}

async function deleteGuidanceMessage(message, guildId, messageId) {
  return queuedMessageDelete(message, 'Night Order Guidance closed')
    .catch(err => {
      logStatusDeleteFailure('delete-night-order-guidance-close', err, {
        guildId,
        messageId,
        subsystem: 'NightOrderGuidance'
      })
      return DELETE_UNAVAILABLE
    })
}

module.exports = {
  deleteNightOrderGuidanceMessage
}
