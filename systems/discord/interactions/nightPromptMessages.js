const {
  isStaleMessageError,
  queuedChannelSend,
  queuedMessageEdit
} = require('../../../utils/discord/messageActions')

const PROMPT_REF_UNAVAILABLE = Symbol('prompt-ref-unavailable')
const PROMPT_WRITE_UNAVAILABLE = Symbol('prompt-write-unavailable')
const ROLE_CHANGE_INFO_PROMPT_KEY = 'role_change_info'

async function sendOrEditNightPromptMessage({
  action = null,
  channel,
  client = null,
  game = null,
  gameLifecycle = null,
  guildId,
  logger = null,
  payload,
  playerId
}) {
  const safePayload = { ...payload, components: payload.components || [] }
  const context = { actionId: action?.id, guildId, playerId }
  const existing = await fetchReusablePromptMessage({ action, channel, client, game, guildId, logger, playerId })
  if (existing === PROMPT_REF_UNAVAILABLE) return null
  const edited = existing ? await queuedMessageEdit(existing, safePayload).catch(err => {
    logger?.recoverable?.('edit-night-prompt-message', err, {
      ...context,
      channelId: existing.channelId,
      messageId: existing.id
    })
    return PROMPT_WRITE_UNAVAILABLE
  }) : null
  if (edited === PROMPT_WRITE_UNAVAILABLE) return null
  const message = edited || await queuedChannelSend(channel, safePayload).catch(err => {
    logger?.recoverable?.('send-night-prompt-message', err, {
      ...context,
      channelId: channel?.id
    })
    return null
  })
  if (!message) return null

  recordPromptMessage({ action, game, gameLifecycle, guildId, message, playerId })
  return { edited: Boolean(edited), message, sent: !edited }
}

async function fetchReusablePromptMessage({ action, channel, client, game, guildId, logger, playerId }) {
  const ref = getReusablePromptRef(game, playerId, action)
  if (!ref) return null
  return fetchPromptMessage({ actionId: action?.id, channel, client, guildId, logger, playerId, ref })
}

function getReusablePromptRef(game, playerId, action) {
  const ownRef = toPromptRef(action)
  if (ownRef) return ownRef
  const nightInfoPromptKey = getNightInfoPromptKey(action)
  if (nightInfoPromptKey) return getNightInfoPromptRef(game, playerId, nightInfoPromptKey)
  if (isProtectedRoleInfoAction(action)) return getProtectedRoleInfoPromptRef(game, playerId)

  const storedRef = game?.nightPromptMessages?.[playerId]
  if (storedRef?.channelId && storedRef?.messageId) return storedRef

  return [...(game?.nightActions || [])].reverse()
    .filter(item => (item.actorId || item.playerId) === playerId)
    .filter(item => !isProtectedRoleInfoAction(item))
    .map(toPromptRef)
    .find(Boolean) || null
}

async function fetchPromptMessage({ actionId, channel, client, guildId, logger, playerId, ref }) {
  const targetChannel = await fetchPromptChannel({ actionId, channel, client, guildId, logger, playerId, ref })
  if (targetChannel === PROMPT_REF_UNAVAILABLE) return PROMPT_REF_UNAVAILABLE
  if (!targetChannel) return null
  if (!targetChannel.messages?.fetch) {
    logger?.recoverable?.('fetch-night-prompt-message-unavailable', new Error('Channel message API unavailable'), {
      actionId,
      channelId: ref.channelId,
      guildId,
      messageId: ref.messageId,
      playerId
    })
    return PROMPT_REF_UNAVAILABLE
  }
  return targetChannel.messages.fetch(ref.messageId).catch(err => {
    if (isStaleMessageError(err)) return null
    logger?.recoverable?.('fetch-night-prompt-message', err, {
      actionId,
      channelId: ref.channelId,
      guildId,
      messageId: ref.messageId,
      playerId
    })
    return PROMPT_REF_UNAVAILABLE
  })
}

async function fetchPromptChannel({ actionId, channel, client, guildId, logger, playerId, ref }) {
  if (ref.channelId === channel?.id) return channel
  if (!client?.channels?.fetch) {
    logger?.warn?.('fetch-night-prompt-channel-unavailable', 'Stored night prompt channel cannot be verified without a Discord client.', {
      actionId,
      channelId: ref.channelId,
      guildId,
      messageId: ref.messageId,
      playerId
    })
    return PROMPT_REF_UNAVAILABLE
  }

  return client.channels.fetch(ref.channelId).catch(err => {
    logger?.recoverable?.('fetch-night-prompt-channel', err, {
      actionId,
      channelId: ref.channelId,
      guildId,
      playerId
    })
    return isMissingChannelError(err) ? null : PROMPT_REF_UNAVAILABLE
  })
}

function recordPromptMessage({ action, game, gameLifecycle, guildId, message, playerId }) {
  if (action?.id) {
    action.promptChannelId = message.channelId
    action.promptMessageId = message.id
    gameLifecycle?.setNightActionPrompt?.(guildId, action.id, message.channelId, message.id)
  }

  if (!game) return
  const nightInfoPromptKey = getNightInfoPromptKey(action)
  if (nightInfoPromptKey) {
    game.nightInfoPromptMessages ??= {}
    game.nightInfoPromptMessages[playerId] ??= {}
    game.nightInfoPromptMessages[playerId][nightInfoPromptKey] = { channelId: message.channelId, messageId: message.id }
    gameLifecycle?.save?.()
    return
  }

  if (isProtectedRoleInfoAction(action)) {
    game.roleInfoPromptMessages ??= {}
    game.roleInfoPromptMessages[playerId] = { channelId: message.channelId, messageId: message.id }
    gameLifecycle?.save?.()
    return
  }

  game.nightPromptMessages ??= {}
  game.nightPromptMessages[playerId] = { channelId: message.channelId, messageId: message.id }
  gameLifecycle?.save?.()
}

function getProtectedRoleInfoPromptRef(game, playerId) {
  const storedRef = game?.roleInfoPromptMessages?.[playerId]
  if (storedRef?.channelId && storedRef?.messageId) return storedRef

  return [...(game?.nightActions || [])].reverse()
    .filter(item => (item.actorId || item.playerId) === playerId)
    .filter(isFirstNightRoleInfoPromptAction)
    .map(toPromptRef)
    .find(Boolean) || null
}

function getNightInfoPromptRef(game, playerId, promptKey) {
  const storedRef = game?.nightInfoPromptMessages?.[playerId]?.[promptKey]
  if (storedRef?.channelId && storedRef?.messageId) return storedRef

  return [...(game?.nightActions || [])].reverse()
    .filter(item => (item.actorId || item.playerId) === playerId)
    .filter(item => getNightInfoPromptKey(item) === promptKey)
    .map(toPromptRef)
    .find(Boolean) || null
}

function clearNightInfoPromptRef(game, playerId, promptKey, ref = null) {
  const storedRef = game?.nightInfoPromptMessages?.[playerId]?.[promptKey]
  if (!storedRef) return false
  if (ref && (storedRef.channelId !== ref.channelId || storedRef.messageId !== ref.messageId)) return false

  delete game.nightInfoPromptMessages[playerId][promptKey]
  if (!Object.keys(game.nightInfoPromptMessages[playerId]).length) {
    delete game.nightInfoPromptMessages[playerId]
  }
  return true
}

function toPromptRef(action) {
  if (!action?.promptChannelId || !action?.promptMessageId) return null
  return { channelId: action.promptChannelId, messageId: action.promptMessageId }
}

function isProtectedRoleInfoAction(action) {
  if (action?.firstNightRoleInfo === true) return true
  if (action?.purpose === 'first_night_info') return true
  if (action?.purpose === 'role_change_info') return true
  return false
}

function isFirstNightRoleInfoPromptAction(action) {
  return isProtectedRoleInfoAction(action) && !getNightInfoPromptKey(action)
}

function getNightInfoPromptKey(action) {
  if (!action) return null
  if (action.nightInfoPromptKey) return String(action.nightInfoPromptKey)
  if (action.purpose === 'role_change_info') return ROLE_CHANGE_INFO_PROMPT_KEY
  return null
}

function isMissingChannelError(err) {
  const code = err?.code ?? err?.rawError?.code
  const message = String(err?.rawError?.message || err?.message || '').toLowerCase()
  return code === 10003 || message.includes('unknown channel')
}

module.exports = {
  ROLE_CHANGE_INFO_PROMPT_KEY,
  clearNightInfoPromptRef,
  getNightInfoPromptRef,
  getProtectedRoleInfoPromptRef,
  getReusablePromptRef,
  isProtectedRoleInfoAction,
  sendOrEditNightPromptMessage
}
