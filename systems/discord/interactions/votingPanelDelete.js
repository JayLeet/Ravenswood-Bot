const {
  isStaleMessageError,
  queuedMessageDelete
} = require('../../../utils/discord/messageActions')
const {
  createVotingPanelSignatureKey
} = require('./votingPanelPosting')

async function deleteVotingPanel({ client, guildId, log = null, messageSignatures, nomination, serverConfigs }) {
  const serverConfig = serverConfigs.get(guildId)
  if (!serverConfig?.liveChannelId || !nomination?.messageId) return null
  if (!client?.channels?.fetch) {
    log?.recoverable?.('fetch-voting-panel-delete-channel-unavailable', new Error('Discord client channel API unavailable'), {
      channelId: serverConfig.liveChannelId,
      guildId,
      nominationId: nomination.id
    })
    return null
  }

  const channel = await client.channels.fetch(serverConfig.liveChannelId).catch(err => {
    log?.recoverable?.('fetch-voting-panel-delete-channel', err, {
      channelId: serverConfig.liveChannelId,
      guildId,
      nominationId: nomination.id
    })
    return null
  })
  if (!channel?.messages?.fetch) {
    log?.recoverable?.('fetch-voting-panel-delete-message-unavailable', new Error('Channel message API unavailable'), {
      channelId: serverConfig.liveChannelId,
      guildId,
      messageId: nomination.messageId,
      nominationId: nomination.id
    })
    return null
  }

  const message = await channel.messages.fetch(nomination.messageId).catch(err => {
    if (isStaleMessageError(err)) {
      messageSignatures.delete(createVotingPanelSignatureKey(guildId, nomination.messageId))
      return null
    }

    log?.recoverable?.('fetch-voting-panel-delete-message', err, {
      channelId: serverConfig.liveChannelId,
      guildId,
      messageId: nomination.messageId,
      nominationId: nomination.id
    })
    return null
  })
  if (!message) return null

  const deleted = await queuedMessageDelete(message, 'BOTC cancelled nomination panel').catch(err => {
    log?.recoverable?.('delete-voting-panel-message', err, {
      guildId,
      messageId: message.id,
      nominationId: nomination.id
    })
    return false
  })
  if (deleted === false) return null

  messageSignatures.delete(createVotingPanelSignatureKey(guildId, message))
  return deleted
}

module.exports = {
  deleteVotingPanel
}
