const {
  sharedDiscordActionQueue
} = require('./actionQueue')
const {
  sharedDiscordActionThrottle
} = require('./actionThrottle')
const {
  sharedDiscordApiMetrics
} = require('./apiMetrics')
const {
  runMeasuredDiscordAction
} = require('./measuredAction')
const {
  createPayloadSignature
} = require('./payloadSignature')
const {
  resolveButtonEmoji
} = require('../buttonEmoji')

const DEFAULT_MESSAGE_EDIT_SIGNATURE_TTL_MS = 60 * 60 * 1000
const DEFAULT_MAX_MESSAGE_EDIT_SIGNATURES = 1000
const messageEditSignatures = new Map()

function queuedMessageDelete(message, reason = null) {
  return runQueuedMessageAction('message-delete', message, () => message.delete(reason))
}

function queuedMessageEdit(message, payload) {
  const safePayload = decorateButtonPayload(payload)
  const target = getMessageTarget(message)
  const signature = createPayloadSignature(safePayload)

  return sharedDiscordActionQueue.run(createMessageActionQueueKey('message-edit', message), async () => {
    if (getMessageEditSignature(target) === signature) {
      sharedDiscordApiMetrics.skipped('message-edit', { target })
      return message
    }

    await sharedDiscordActionThrottle.waitTurn(createMessageActionQueueKey('message-edit', message))
    const edited = await runMeasuredMessageAction('message-edit', target, () => message.edit(safePayload))
    if (!edited) {
      messageEditSignatures.delete(target)
      return null
    }

    setMessageEditSignature(target, signature)
    return edited
  })
}

function queuedChannelSend(channel, payload) {
  const safePayload = decorateButtonPayload(payload)
  const key = createChannelActionQueueKey('message-send', channel)
  const target = getChannelTarget(channel)
  return sharedDiscordActionQueue.run(key, async () => {
    await sharedDiscordActionThrottle.waitTurn(key)
    return runMeasuredMessageAction('message-send', target, () => channel.send(safePayload))
  })
}

function decorateButtonPayload(payload = {}, { preserveBuilders = false } = {}) {
  if (!Array.isArray(payload.components)) return payload
  return {
    ...payload,
    components: payload.components.map(row => decorateActionRow(row, { preserveBuilders }))
  }
}

function decorateActionRow(row, { preserveBuilders = false } = {}) {
  if (preserveBuilders && typeof row?.toJSON === 'function' && Array.isArray(row.components)) {
    row.components.forEach(decorateComponentBuilder)
    return row
  }

  const data = typeof row?.toJSON === 'function' ? row.toJSON() : clonePlain(row)
  if (!Array.isArray(data?.components)) return data
  return { ...data, components: data.components.map(decorateComponent) }
}

function decorateComponentBuilder(component) {
  if (typeof component?.toJSON !== 'function' || typeof component?.setEmoji !== 'function') return component
  const data = component.toJSON()
  if (data.type !== 2 || data.emoji) return component
  const emoji = resolveButtonEmoji(data.label, data.custom_id)
  if (emoji) component.setEmoji(emoji)
  return component
}

function decorateComponent(component) {
  if (!component || component.type !== 2 || component.emoji) return component
  const emoji = resolveButtonEmoji(component.label, component.custom_id)
  if (!emoji) return component
  return { ...component, emoji: { name: emoji } }
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value))
}

function runQueuedMessageAction(action, message, write) {
  const key = createMessageActionQueueKey(action, message)
  const target = getMessageTarget(message)
  return sharedDiscordActionQueue.run(key, async () => {
    await sharedDiscordActionThrottle.waitTurn(key)
    const result = await runMeasuredMessageAction(action, target, write)
    if (!result && action === 'message-delete') clearMessageEditSignatures(message)
    return result
  })
}

async function runMeasuredMessageAction(action, target, fn) {
  return runMeasuredDiscordAction(action, target, fn, {
    ignoredReason: 'stale-message',
    ignoreError: isStaleMessageError,
    metrics: sharedDiscordApiMetrics
  })
}

function clearMessageEditSignatures(message = null) {
  if (!message) {
    messageEditSignatures.clear()
    return
  }
  messageEditSignatures.delete(getMessageTarget(message))
}

function getMessageEditSignature(target) {
  const entry = messageEditSignatures.get(target)
  return typeof entry === 'string' ? entry : entry?.signature || null
}

function setMessageEditSignature(target, signature, now = Date.now()) {
  if (messageEditSignatures.has(target)) messageEditSignatures.delete(target)
  messageEditSignatures.set(target, { signature, updatedAt: now })
  pruneMessageEditSignatures({ now })
}

function pruneMessageEditSignatures({
  maxAgeMs = DEFAULT_MESSAGE_EDIT_SIGNATURE_TTL_MS,
  maxEntries = DEFAULT_MAX_MESSAGE_EDIT_SIGNATURES,
  now = Date.now()
} = {}) {
  let removed = 0
  if (Number.isFinite(maxAgeMs) && maxAgeMs >= 0) {
    const cutoff = now - maxAgeMs
    for (const [target, entry] of messageEditSignatures.entries()) {
      const updatedAt = typeof entry === 'string' ? now : Number(entry?.updatedAt) || 0
      if (updatedAt > cutoff) continue
      messageEditSignatures.delete(target)
      removed += 1
    }
  }

  while (messageEditSignatures.size > maxEntries) {
    const oldestTarget = messageEditSignatures.keys().next().value
    if (!oldestTarget) break
    messageEditSignatures.delete(oldestTarget)
    removed += 1
  }

  return { removed, size: messageEditSignatures.size }
}

function getMessageEditSignatureCount() {
  return messageEditSignatures.size
}

function isStaleMessageError(err) {
  const code = err?.code ?? err?.rawError?.code
  const message = String(err?.rawError?.message || err?.message || '').toLowerCase()
  return code === 10008 ||
    code === 10003 ||
    code === 'ChannelNotCached' ||
    message.includes('unknown message') ||
    message.includes('unknown channel') ||
    message.includes('could not find the channel')
}

function createMessageActionQueueKey(action, message) {
  return [
    action || 'message-action',
    message?.guildId || message?.guild?.id || 'unknown-guild',
    message?.channelId || message?.channel?.id || 'unknown-channel',
    message?.id || 'unknown-message'
  ].join(':')
}

function createChannelActionQueueKey(action, channel) {
  return [
    action || 'channel-action',
    channel?.guildId || channel?.guild?.id || 'unknown-guild',
    channel?.id || 'unknown-channel'
  ].join(':')
}

function getMessageTarget(message) {
  return [
    message?.guildId || message?.guild?.id || 'unknown-guild',
    message?.channelId || message?.channel?.id || 'unknown-channel',
    message?.id || 'unknown-message'
  ].join(':')
}

function getChannelTarget(channel) {
  return [
    channel?.guildId || channel?.guild?.id || 'unknown-guild',
    channel?.id || 'unknown-channel'
  ].join(':')
}

module.exports = {
  clearMessageEditSignatures,
  decorateButtonPayload,
  getChannelTarget,
  getMessageEditSignatureCount,
  isStaleMessageError,
  pruneMessageEditSignatures,
  queuedChannelSend,
  queuedMessageDelete,
  queuedMessageEdit,
  resolveButtonEmoji
}
