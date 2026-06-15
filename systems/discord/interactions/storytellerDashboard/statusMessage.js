const {
  createSystemEmbed
} = require('../feedback')
const {
  createPayloadSignature
} = require('../../../../utils/discord/payloadSignature')
const {
  queuedChannelSend,
  queuedMessageDelete,
  queuedMessageEdit
} = require('../../../../utils/discord/messageActions')
const {
  runRecoverableDiscordAction
} = require('../../../../utils/discord/recoverableAction')
const {
  fetchStatusMessage,
  fetchStatusMessageState,
  logStatusDeleteFailure
} = require('./statusMessageRefs')
const {
  createGotItRow,
  createPayloadFromMessage,
  getActiveStatusMessageIds,
  hasPayloadContent,
  isDashboardFeedbackEmbed,
  isTemporaryDashboardFeedback,
  prunePayloadMemory,
  shouldClearNightOrderGuidance
} = require('./statusMessagePayloads')

const DELETE_UNAVAILABLE = Symbol('delete-unavailable')

function createStorytellerDashboardStatus({ serverConfigs, saveServerConfigs }) {
  const payloadSignatures = new Map()
  const payloadsByMessageId = new Map()
  const subsystem = 'StorytellerDashboardStatus'

  async function update(interaction, serverConfig, title, description, color = 0x2ecc71) {
    return updatePayload(interaction, serverConfig, {
      embeds: [createSystemEmbed(title, description, color)],
      components: [createGotItRow()]
    })
  }

  async function updatePayload(interaction, serverConfig, payload) {
    if (!serverConfig?.storytellerChannelId) return null

    const guildId = interaction.guild.id
    const channel = await fetchTextChannel(interaction.client, serverConfig.storytellerChannelId, {
      guildId,
      subsystem
    })

    if (!channel?.isTextBased?.()) return null

    await clearNightOrderGuidanceForControlPayload(channel, guildId, serverConfig, payload)

    const signature = createPayloadSignature(payload)
    const fetched = await fetchStatusMessageState(channel, serverConfig.storytellerDashboardStatusMessageId, { guildId, subsystem })
    if (fetched.unavailable) return null
    const existing = fetched.message
    if (existing) {
      if (payloadSignatures.get(existing.id) === signature) return existing
      const updated = await recover('edit-status-message', () => queuedMessageEdit(existing, payload), {
        guildId,
        messageId: existing.id,
        subsystem
      })
      if (updated) {
        rememberPayload(updated.id, payload, signature)
        return updated
      }
    }

    const sent = await recover('send-status-message', () => queuedChannelSend(channel, payload), {
      channelId: channel.id,
      guildId,
      subsystem
    })
    if (!sent) return null

    rememberPayload(sent.id, payload, signature)
    serverConfig.storytellerDashboardStatusMessageId = sent.id
    serverConfigs.set(guildId, serverConfig)
    saveServerConfigs(serverConfigs)
    return sent
  }

  async function clearNightOrderGuidanceForControlPayload(channel, guildId, serverConfig, payload) {
    if (!shouldClearNightOrderGuidance(payload)) return null

    const messageId = serverConfig.storytellerNightOrderGuidanceMessageId
    if (!messageId) return null

    const fetched = await fetchStatusMessageState(channel, messageId, { guildId, subsystem })
    if (fetched.unavailable) return null
    const message = fetched.message
    if (message) {
      const deleted = await queuedMessageDelete(message, 'Night Order Guidance replaced by another dashboard embed')
        .catch(err => { logStatusDeleteFailure('delete-night-order-guidance', err, { guildId, messageId, subsystem }); return DELETE_UNAVAILABLE })
      if (deleted === DELETE_UNAVAILABLE) return null
    }

    delete serverConfig.storytellerNightOrderGuidanceMessageId
    serverConfigs.set(guildId, serverConfig)
    saveServerConfigs(serverConfigs)
    return null
  }

  async function moveToBottom(channel, guildId, serverConfig) {
    const messageId = serverConfig?.storytellerDashboardStatusMessageId
    if (!messageId) return null

    const fetched = await fetchStatusMessageState(channel, messageId, { guildId, subsystem })
    if (fetched.unavailable) return null
    const existing = fetched.message
    if (!existing) {
      delete serverConfig.storytellerDashboardStatusMessageId
      serverConfigs.set(guildId, serverConfig)
      saveServerConfigs(serverConfigs)
      return null
    }

    const payload = payloadsByMessageId.get(existing.id) || createPayloadFromMessage(existing)
    if (!hasPayloadContent(payload)) return existing

    const sent = await recover('resend-status-message', () => queuedChannelSend(channel, payload), {
      channelId: channel.id,
      guildId,
      subsystem
    })
    if (!sent) return existing

    const deleted = await recover(
      'delete-moved-status-message',
      () => queuedMessageDelete(existing, 'Move Storyteller dashboard status to bottom').then(() => true),
      { guildId, messageId: existing.id, subsystem },
      { fallback: DELETE_UNAVAILABLE }
    )
    if (deleted === DELETE_UNAVAILABLE) {
      await recover(
        'delete-untracked-moved-status-message',
        () => queuedMessageDelete(sent, 'Discard duplicate Storyteller dashboard status after move failed'),
        { guildId, messageId: sent.id, subsystem }
      )
      return existing
    }

    payloadSignatures.delete(existing.id)
    payloadsByMessageId.delete(existing.id)
    rememberPayload(sent.id, payload, createPayloadSignature(payload))
    serverConfig.storytellerDashboardStatusMessageId = sent.id
    serverConfigs.set(guildId, serverConfig)
    saveServerConfigs(serverConfigs)
    return sent
  }

  function rememberPayload(messageId, payload, signature) {
    payloadSignatures.set(messageId, signature)
    payloadsByMessageId.set(messageId, payload)
  }

  return {
    getRuntimeState,
    moveToBottom,
    update,
    updatePayload,
    clearStatusMessage
  }

  async function clearStatusMessage(interaction, serverConfig) {
    const messageId = serverConfig?.storytellerDashboardStatusMessageId
    if (!messageId) return null
    const channel = await fetchTextChannel(interaction.client, serverConfig.storytellerChannelId, {
      guildId: interaction.guild.id,
      subsystem
    })
    const fetched = await fetchStatusMessageState(channel, messageId, { guildId: interaction.guild.id, subsystem })
    if (fetched.unavailable) return null
    const message = fetched.message
    if (message) {
      const deleted = await queuedMessageDelete(message, 'Dismiss Storyteller dashboard feedback')
        .catch(err => { logStatusDeleteFailure('delete-status-message', err, { guildId: interaction.guild.id, messageId, subsystem }); return DELETE_UNAVAILABLE })
      if (deleted === DELETE_UNAVAILABLE) return null
    }
    delete serverConfig.storytellerDashboardStatusMessageId
    serverConfigs.set(interaction.guild.id, serverConfig)
    saveServerConfigs(serverConfigs)
    payloadSignatures.delete(messageId)
    payloadsByMessageId.delete(messageId)
    return null
  }

  function getRuntimeState() {
    const removedPayloads = prunePayloadMemory(serverConfigs, {
      payloadSignatures,
      payloadsByMessageId
    })
    return {
      payloads: payloadsByMessageId.size,
      payloadSignatures: payloadSignatures.size,
      removedPayloads
    }
  }
}

async function fetchTextChannel(client, channelId, context = {}) {
  if (!channelId) return null
  const channel = await recover(
    'fetch-text-channel',
    () => client.channels.fetch(channelId),
    { ...context, channelId }
  )
  return channel?.isTextBased?.() ? channel : null
}

function recover(action, fn, context = {}, options = {}) {
  const { subsystem = 'StorytellerDashboardStatus', ...rest } = context
  return runRecoverableDiscordAction(action, fn, {
    context: rest,
    subsystem,
    ...options
  })
}

module.exports = {
  createGotItRow,
  createPayloadFromMessage,
  createStorytellerDashboardStatus,
  fetchStatusMessage,
  getActiveStatusMessageIds,
  hasPayloadContent,
  isDashboardFeedbackEmbed,
  isTemporaryDashboardFeedback,
  prunePayloadMemory,
  shouldClearNightOrderGuidance
}
