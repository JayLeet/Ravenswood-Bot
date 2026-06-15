const {
  createNightOrderGuidancePayload
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
  getNightOrderState,
  clearNightOrderState
} = require('./nightOrderState')
const {
  findReusableDashboardPanel
} = require('./dashboardCleanup')

const FETCH_FAILED = Symbol('night-order-guidance-message-fetch-failed')
const pendingNightOrderGuidanceSyncs = new Map()

function syncNightOrderGuidanceMessage(args) {
  const key = String(args?.guildId || '')
  const pending = pendingNightOrderGuidanceSyncs.get(key)
  if (pending) return pending

  const promise = syncNightOrderGuidanceMessageNow(args)
    .finally(() => pendingNightOrderGuidanceSyncs.delete(key))
  pendingNightOrderGuidanceSyncs.set(key, promise)
  return promise
}

async function syncNightOrderGuidanceMessageNow({
  channel,
  guildId,
  messageSignatures,
  moveStatusMessageToBottom,
  playerLabels,
  saveServerConfigs,
  serverConfig,
  serverConfigs,
  view
}) {
  const messageId = serverConfig.storytellerNightOrderGuidanceMessageId
  const payload = createNightOrderGuidancePayload(view, playerLabels, getNightOrderState(guildId, view))

  if (!payload) {
    clearNightOrderState(guildId)
    return clearNightOrderGuidanceMessage({
      channel,
      guildId,
      messageId,
      saveServerConfigs,
      serverConfig,
      serverConfigs
    })
  }

  const signature = createPayloadSignature(payload)
  const existing = await fetchNightOrderGuidanceMessage(
    channel,
    messageId,
    'fetch-night-order-guidance-message',
    { guildId }
  )
  if (existing === FETCH_FAILED) return null

  if (existing) {
    if (messageSignatures.get(existing.id) === signature) return existing
    const updated = await recover(
      'edit-night-order-guidance-message',
      () => queuedMessageEdit(existing, payload),
      createMessageContext(channel, existing.id, { guildId })
    )
    if (updated) {
      messageSignatures.set(updated.id, signature)
      return updated
    }
  } else if (messageId) {
    delete serverConfig.storytellerNightOrderGuidanceMessageId
    serverConfigs.set(guildId, serverConfig)
    saveServerConfigs(serverConfigs)
  }

  const reused = await reuseExistingNightOrderGuidanceMessage({
    channel,
    guildId,
    messageSignatures,
    moveStatusMessageToBottom,
    payload,
    saveServerConfigs,
    serverConfig,
    serverConfigs,
    signature
  })
  if (reused) return reused

  const message = await recover(
    'send-night-order-guidance-message',
    () => queuedChannelSend(channel, payload),
    createMessageContext(channel, null, { guildId })
  )
  if (!message) return null

  messageSignatures.set(message.id, signature)
  serverConfig.storytellerNightOrderGuidanceMessageId = message.id
  serverConfigs.set(guildId, serverConfig)
  saveServerConfigs(serverConfigs)
  await moveStatusMessageAfterNewPanel(moveStatusMessageToBottom, channel, guildId, serverConfig)
  return message
}

async function reuseExistingNightOrderGuidanceMessage({
  channel,
  guildId,
  messageSignatures,
  moveStatusMessageToBottom,
  payload,
  saveServerConfigs,
  serverConfig,
  serverConfigs,
  signature
}) {
  const message = await findReusableDashboardPanel(
    channel,
    'Night Order Guidance',
    [serverConfig.storytellerNightOrderGuidanceMessageId]
  )
  if (!message) return null

  if (messageSignatures.get(message.id) === signature) {
    trackNightOrderGuidanceMessage({ guildId, message, saveServerConfigs, serverConfig, serverConfigs })
    return message
  }

  const updated = await recover(
    'edit-reused-night-order-guidance-message',
    () => queuedMessageEdit(message, payload),
    createMessageContext(channel, message.id, { guildId })
  )
  if (!updated) return null

  messageSignatures.set(updated.id, signature)
  trackNightOrderGuidanceMessage({ guildId, message: updated, saveServerConfigs, serverConfig, serverConfigs })
  await moveStatusMessageAfterNewPanel(moveStatusMessageToBottom, channel, guildId, serverConfig)
  return updated
}

function trackNightOrderGuidanceMessage({ guildId, message, saveServerConfigs, serverConfig, serverConfigs }) {
  if (serverConfig.storytellerNightOrderGuidanceMessageId === message.id) return
  serverConfig.storytellerNightOrderGuidanceMessageId = message.id
  serverConfigs.set(guildId, serverConfig)
  saveServerConfigs(serverConfigs)
}

async function moveStatusMessageAfterNewPanel(moveStatusMessageToBottom, channel, guildId, serverConfig) {
  if (typeof moveStatusMessageToBottom !== 'function') return null
  return recover(
    'move-status-after-night-order-guidance',
    () => moveStatusMessageToBottom(channel, guildId, serverConfig),
    createMessageContext(channel, serverConfig?.storytellerDashboardStatusMessageId, { guildId })
  )
}

async function clearNightOrderGuidanceMessage({
  channel,
  guildId,
  messageId,
  saveServerConfigs,
  serverConfig,
  serverConfigs
}) {
  if (!messageId) return null

  const message = await fetchNightOrderGuidanceMessage(
    channel,
    messageId,
    'fetch-night-order-guidance-message-for-clear',
    { guildId }
  )
  if (message === FETCH_FAILED) return null
  if (message) {
    const deleted = await recover(
      'delete-night-order-guidance-message',
      () => queuedMessageDelete(message, 'Night Order Guidance hidden outside night'),
      createMessageContext(channel, message.id, { guildId }),
      { fallback: false }
    )
    if (deleted === false) return null
  }

  delete serverConfig.storytellerNightOrderGuidanceMessageId
  serverConfigs.set(guildId, serverConfig)
  saveServerConfigs(serverConfigs)
  return null
}

async function fetchNightOrderGuidanceMessage(channel, messageId, action, context = {}) {
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
    subsystem: 'StorytellerNightOrderGuidance',
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
  clearNightOrderGuidanceMessage,
  moveStatusMessageAfterNewPanel,
  reuseExistingNightOrderGuidanceMessage,
  syncNightOrderGuidanceMessage
}
