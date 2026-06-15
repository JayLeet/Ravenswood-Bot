const {
  createPayloadSignature
} = require('../../../../utils/discord/payloadSignature')
const {
  isStaleMessageError,
  queuedChannelSend,
  queuedMessageEdit
} = require('../../../../utils/discord/messageActions')
const {
  runRecoverableDiscordAction
} = require('../../../../utils/discord/recoverableAction')
const {
  findReusableDashboardPanel
} = require('./dashboardCleanup')

const FETCH_FAILED = Symbol('storyteller-dashboard-message-fetch-failed')

async function upsertDashboardMessage({
  channel,
  guildId,
  messageSignatures,
  moveStatusMessageToBottom,
  payload,
  saveServerConfigs,
  serverConfig,
  serverConfigs
}) {
  const signature = createPayloadSignature(payload)
  const currentMessageId = serverConfig.storytellerDashboardMessageId
  let message = await fetchDashboardMessage(channel, currentMessageId, { guildId })
  if (message === FETCH_FAILED) return null

  if (message) {
    if (messageSignatures.get(message.id) === signature) return message
    const updated = await recover(
      'edit-storyteller-dashboard-message',
      () => queuedMessageEdit(message, payload),
      createMessageContext(channel, message.id, { guildId })
    )
    if (updated) {
      messageSignatures.set(updated.id, signature)
      return updated
    }
  } else if (currentMessageId) {
    delete serverConfig.storytellerDashboardMessageId
    serverConfigs.set(guildId, serverConfig)
    saveServerConfigs(serverConfigs)
  }

  message = await reuseExistingDashboardMessage({
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
  if (message) return message

  message = await recover(
    'send-storyteller-dashboard-message',
    () => queuedChannelSend(channel, payload),
    createMessageContext(channel, null, { guildId })
  )
  if (!message) return null

  messageSignatures.set(message.id, signature)
  serverConfig.storytellerDashboardMessageId = message.id
  serverConfigs.set(guildId, serverConfig)
  saveServerConfigs(serverConfigs)
  await moveStatusMessageAfterNewPanel(moveStatusMessageToBottom, channel, guildId, serverConfig)
  return message
}

async function reuseExistingDashboardMessage({
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
    'Storyteller Dashboard',
    [serverConfig.storytellerDashboardMessageId]
  )
  if (!message) return null

  if (messageSignatures.get(message.id) === signature) {
    trackDashboardMessage({ guildId, message, saveServerConfigs, serverConfig, serverConfigs })
    return message
  }

  const updated = await recover(
    'edit-reused-storyteller-dashboard-message',
    () => queuedMessageEdit(message, payload),
    createMessageContext(channel, message.id, { guildId })
  )
  if (!updated) return null

  messageSignatures.set(updated.id, signature)
  trackDashboardMessage({ guildId, message: updated, saveServerConfigs, serverConfig, serverConfigs })
  await moveStatusMessageAfterNewPanel(moveStatusMessageToBottom, channel, guildId, serverConfig)
  return updated
}

function trackDashboardMessage({ guildId, message, saveServerConfigs, serverConfig, serverConfigs }) {
  if (serverConfig.storytellerDashboardMessageId === message.id) return
  serverConfig.storytellerDashboardMessageId = message.id
  serverConfigs.set(guildId, serverConfig)
  saveServerConfigs(serverConfigs)
}

async function moveStatusMessageAfterNewPanel(moveStatusMessageToBottom, channel, guildId, serverConfig) {
  if (typeof moveStatusMessageToBottom !== 'function') return null
  return recover(
    'move-status-after-storyteller-dashboard',
    () => moveStatusMessageToBottom(channel, guildId, serverConfig),
    createMessageContext(channel, serverConfig?.storytellerDashboardStatusMessageId, { guildId })
  )
}

function fetchDashboardMessage(channel, messageId, context = {}) {
  if (!messageId) return null
  if (!channel?.messages?.fetch) {
    return recover(
      'fetch-storyteller-dashboard-message-unavailable',
      () => { throw new Error('Channel message API unavailable') },
      createMessageContext(channel, messageId, context),
      { fallback: FETCH_FAILED }
    )
  }

  return recover(
    'fetch-storyteller-dashboard-message',
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
    subsystem: 'StorytellerDashboardMessage',
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
  moveStatusMessageAfterNewPanel,
  reuseExistingDashboardMessage,
  upsertDashboardMessage
}
