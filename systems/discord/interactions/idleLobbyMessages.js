const {
  isStaleMessageError,
  queuedChannelSend,
  queuedMessageDelete,
  queuedMessageEdit
} = require('../../../utils/discord/messageActions')
const {
  runRecoverableDiscordAction
} = require('../../../utils/discord/recoverableAction')

const IDLE_WARNING_FETCH_UNAVAILABLE = Symbol('IDLE_WARNING_FETCH_UNAVAILABLE')

function createIdleLobbyWarningMessages({ client, serverConfigs, subsystem = 'IdleLobbyWatch' }) {
  async function sendOrEdit(guildId, watch, payload) {
    const channel = await getStorytellerChannel(guildId)
    if (!channel) return null

    const known = await fetchKnownWarningMessage(channel, watch, guildId)
    if (known === IDLE_WARNING_FETCH_UNAVAILABLE) return null

    if (known) {
      return recover('edit-idle-warning', () => queuedMessageEdit(known, payload), {
        guildId,
        messageId: known.id
      })
    }
    return recover('send-idle-warning', () => queuedChannelSend(channel, payload), {
      channelId: channel.id,
      guildId
    })
  }

  function fetchKnownWarningMessage(channel, watch, guildId) {
    if (!watch?.message?.id) return null
    if (!channel?.messages?.fetch) {
      return runRecoverableDiscordAction(
        'fetch-idle-warning-message-unavailable',
        () => {
          throw new Error('Channel message API unavailable')
        },
        {
          context: {
            channelId: channel?.id,
            guildId,
            messageId: watch.message.id
          },
          fallback: IDLE_WARNING_FETCH_UNAVAILABLE,
          subsystem
        }
      )
    }

    return runRecoverableDiscordAction(
      'fetch-idle-warning-message',
      () => channel.messages.fetch(watch.message.id),
      {
        context: {
          channelId: channel.id,
          guildId,
          messageId: watch.message.id
        },
        fallback: IDLE_WARNING_FETCH_UNAVAILABLE,
        ignoreError: isStaleMessageError,
        ignoredFallback: null,
        subsystem
      }
    )
  }

  async function deleteMessage(message, guildId, action, reason) {
    if (!message) return null
    return recover(action, () => queuedMessageDelete(message, reason), {
      guildId,
      messageId: message.id
    })
  }

  async function getStorytellerChannel(guildId) {
    const config = serverConfigs.get(guildId)
    if (!config?.storytellerChannelId) return null
    const channel = await recover('fetch-storyteller-channel', () => client.channels.fetch(config.storytellerChannelId), {
      channelId: config.storytellerChannelId,
      guildId
    })
    return channel?.isTextBased?.() ? channel : null
  }

  function recover(action, fn, context = {}) {
    return runRecoverableDiscordAction(action, fn, {
      context,
      subsystem
    })
  }

  return {
    deleteMessage,
    sendOrEdit
  }
}

module.exports = {
  createIdleLobbyWarningMessages
}
