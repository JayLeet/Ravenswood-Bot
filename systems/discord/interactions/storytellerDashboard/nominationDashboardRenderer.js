const {
  createNominationDashboardPayload
} = require('../../embeds')
const {
  createPayloadSignature
} = require('../../../../utils/discord/payloadSignature')
const {
  isStaleMessageError,
  queuedChannelSend,
  queuedMessageDelete,
  queuedMessageEdit
} = require('../../../../utils/discord/messageActions')
const {
  runRecoverableDiscordAction
} = require('../../../../utils/discord/recoverableAction')
const {
  findReusableDashboardPanel
} = require('./dashboardCleanup')

const FETCH_FAILED = Symbol('nomination-dashboard-message-fetch-failed')

async function syncNominationDashboardMessage({
  channel,
  guildId,
  messageSignatures,
  moveStatusMessageToBottom,
  saveServerConfigs,
  serverConfig,
  serverConfigs,
  view
}) {
  if (view.phase !== 'nominations') {
    const deleted = await deleteTrackedMessage(channel, serverConfig.storytellerNominationDashboardMessageId, { guildId })
    if (deleted === FETCH_FAILED || deleted === false) return null
    if (serverConfig.storytellerNominationDashboardMessageId) {
      delete serverConfig.storytellerNominationDashboardMessageId
      serverConfigs.set(guildId, serverConfig)
      saveServerConfigs(serverConfigs)
    }
    return null
  }

  const payload = createNominationDashboardPayload(view)
  const message = await upsertTrackedPanelMessage({
    channel,
    currentMessageId: serverConfig.storytellerNominationDashboardMessageId,
    context: { guildId },
    messageSignatures,
    payload,
    reusableTitle: 'Nomination Dashboard',
    staleMessageHandler: () => clearTrackedNominationDashboardMessage({
      guildId,
      saveServerConfigs,
      serverConfig,
      serverConfigs
    })
  })
  if (!message) return null

  if (serverConfig.storytellerNominationDashboardMessageId !== message.id) {
    serverConfig.storytellerNominationDashboardMessageId = message.id
    serverConfigs.set(guildId, serverConfig)
    saveServerConfigs(serverConfigs)
    await moveStatusMessageAfterNewPanel(moveStatusMessageToBottom, channel, guildId, serverConfig)
  }
  return message
}

function clearTrackedNominationDashboardMessage({
  guildId,
  saveServerConfigs,
  serverConfig,
  serverConfigs
}) {
  if (!serverConfig.storytellerNominationDashboardMessageId) return
  delete serverConfig.storytellerNominationDashboardMessageId
  serverConfigs.set(guildId, serverConfig)
  saveServerConfigs(serverConfigs)
}

async function upsertTrackedPanelMessage({
  channel,
  context = {},
  currentMessageId,
  messageSignatures,
  payload,
  reusableTitle = null,
  staleMessageHandler
}) {
  const signature = createPayloadSignature(payload)
  const existing = await fetchNominationDashboardMessage(
    channel,
    currentMessageId,
    'fetch-nomination-dashboard-message',
    context
  )
  if (existing === FETCH_FAILED) return null
  if (existing) {
    if (messageSignatures.get(existing.id) === signature) return existing
    const updated = await recover(
      'edit-nomination-dashboard-message',
      () => queuedMessageEdit(existing, payload),
      createMessageContext(channel, existing.id, context)
    )
    if (updated) {
      messageSignatures.set(updated.id, signature)
      return updated
    }
  } else if (currentMessageId && typeof staleMessageHandler === 'function') {
    staleMessageHandler()
  }

  const reusable = reusableTitle
    ? await findReusableDashboardPanel(channel, reusableTitle, [currentMessageId])
    : null
  if (reusable) {
    if (messageSignatures.get(reusable.id) === signature) return reusable
    const updated = await recover(
      'edit-reused-nomination-dashboard-message',
      () => queuedMessageEdit(reusable, payload),
      createMessageContext(channel, reusable.id, context)
    )
    if (updated) {
      messageSignatures.set(updated.id, signature)
      return updated
    }
  }

  const sent = await recover(
    'send-nomination-dashboard-message',
    () => queuedChannelSend(channel, payload),
    createMessageContext(channel, null, context)
  )
  if (!sent) return null
  messageSignatures.set(sent.id, signature)
  return sent
}

async function deleteTrackedMessage(channel, messageId, context = {}) {
  const message = await fetchNominationDashboardMessage(
    channel,
    messageId,
    'fetch-nomination-dashboard-message-for-delete',
    context
  )
  if (message === FETCH_FAILED) return FETCH_FAILED
  if (!message) return null
  return recover(
    'delete-inactive-nomination-dashboard-message',
    () => queuedMessageDelete(message, 'Remove inactive nomination dashboard'),
    createMessageContext(channel, message.id, context),
    { fallback: false }
  )
}

async function moveStatusMessageAfterNewPanel(moveStatusMessageToBottom, channel, guildId, serverConfig) {
  if (typeof moveStatusMessageToBottom !== 'function') return null
  return recover(
    'move-status-after-nomination-dashboard',
    () => moveStatusMessageToBottom(channel, guildId, serverConfig),
    createMessageContext(channel, serverConfig?.storytellerDashboardStatusMessageId, { guildId })
  )
}

async function fetchNominationDashboardMessage(channel, messageId, action, context = {}) {
  if (!messageId) return null
  if (!channel?.messages?.fetch) {
    return recover(
      `${action}-unavailable`,
      () => { throw new Error('Channel message API unavailable') },
      createMessageContext(channel, messageId, context),
      { fallback: FETCH_FAILED }
    )
  }

  return recover(
    action,
    () => channel.messages.fetch({ message: messageId, cache: false, force: true }),
    createMessageContext(channel, messageId, context),
    {
      fallback: FETCH_FAILED,
      ignoreError: isStaleMessageError,
      ignoredFallback: null
    }
  )
}

function recover(action, fn, context = {}, options = {}) {
  return runRecoverableDiscordAction(action, fn, {
    context,
    subsystem: 'StorytellerDashboardNomination',
    ...options
  })
}

function createMessageContext(channel, messageId = null, context = {}) {
  return {
    channelId: channel?.id,
    guildId: channel?.guildId,
    messageId,
    ...context
  }
}

module.exports = {
  deleteTrackedMessage,
  syncNominationDashboardMessage,
  upsertTrackedPanelMessage
}
