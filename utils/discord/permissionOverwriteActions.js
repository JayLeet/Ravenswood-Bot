const {
  PermissionFlagsBits
} = require('discord.js')
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
  hasPermissionBit,
  normalizePermissionBitfield
} = require('./permissionBits')
const {
  getCachedPermissionOverwrite
} = require('./permissionOverwriteCache')

function editPermissionOverwrite(channel, overwriteId, permissions, reason) {
  const key = createPermissionOverwriteQueueKey(channel, overwriteId, 'edit')
  return sharedDiscordActionQueue.run(key, async () => {
    const target = getPermissionOverwriteTarget(channel, overwriteId)
    if (isFakePermissionOverwriteTargetId(overwriteId)) {
      sharedDiscordApiMetrics.skipped('permission-overwrite-edit', { target })
      return false
    }

    if (isPermissionOverwriteEditNoop(channel, overwriteId, permissions)) {
      sharedDiscordApiMetrics.skipped('permission-overwrite-edit', { target })
      return false
    }

    await sharedDiscordActionThrottle.waitTurn(key)
    return runMeasuredPermissionOverwriteAction('permission-overwrite-edit', target, async () => {
      await channel.permissionOverwrites.edit(overwriteId, permissions, reason)
      return true
    })
  })
}

function setPermissionOverwritesIfChanged(channel, overwrites, reason) {
  const key = createPermissionOverwriteQueueKey(channel, null, 'set')
  return sharedDiscordActionQueue.run(key, async () => {
    const target = getPermissionOverwriteTarget(channel)
    const current = createPermissionOverwriteSignature(channel?.permissionOverwrites?.cache)
    const next = createPermissionOverwriteSignature(overwrites)

    if (current === next) {
      sharedDiscordApiMetrics.skipped('permission-overwrite-set', { target })
      return false
    }

    await sharedDiscordActionThrottle.waitTurn(key)
    return runMeasuredPermissionOverwriteAction('permission-overwrite-set', target, async () => {
      await channel.permissionOverwrites.set(overwrites, reason)
      return true
    })
  })
}

async function runMeasuredPermissionOverwriteAction(action, target, fn) {
  return runMeasuredDiscordAction(action, target, fn, { metrics: sharedDiscordApiMetrics })
}

function isPermissionOverwriteEditNoop(channel, overwriteId, permissions = {}) {
  const entries = Object.entries(permissions || {}).filter(([, value]) => value !== undefined)
  if (!entries.length) return true

  const overwrite = getCachedPermissionOverwrite(channel, overwriteId)
  if (!overwrite) return entries.every(([, value]) => value === null)

  return entries.every(([permissionName, value]) => permissionOverwriteValueMatches(overwrite, permissionName, value))
}

function permissionOverwriteValueMatches(overwrite, permissionName, value) {
  if (value === undefined) return true
  const bit = PermissionFlagsBits[permissionName]
  if (bit === undefined) return false

  const allow = normalizePermissionBitfield(overwrite.allow)
  const deny = normalizePermissionBitfield(overwrite.deny)
  const permissionBit = normalizePermissionBitfield(bit)
  const allows = hasPermissionBit(allow, permissionBit)
  const denies = hasPermissionBit(deny, permissionBit)

  if (value === true) return allows && !denies
  if (value === false) return denies && !allows
  if (value === null) return !allows && !denies
  return false
}

function isFakePermissionOverwriteTargetId(overwriteId) {
  return /^(test-player-|fake[_-])/.test(String(overwriteId || ''))
}

function createPermissionOverwriteSignature(overwrites) {
  return JSON.stringify(normalizePermissionOverwrites(overwrites))
}

function normalizePermissionOverwrites(overwrites) {
  return getPermissionOverwriteValues(overwrites)
    .map(normalizePermissionOverwrite)
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id) || a.type.localeCompare(b.type))
}

function getPermissionOverwriteValues(overwrites) {
  if (!overwrites) return []
  if (Array.isArray(overwrites)) return overwrites
  if (typeof overwrites.values === 'function') return [...overwrites.values()]
  if (typeof overwrites.cache?.values === 'function') return [...overwrites.cache.values()]
  return []
}

function normalizePermissionOverwrite(overwrite) {
  const id = String(overwrite?.id || '')
  if (!id) return null
  return {
    allow: normalizeBitfield(overwrite.allow),
    deny: normalizeBitfield(overwrite.deny),
    id,
    type: String(overwrite.type ?? '')
  }
}

function normalizeBitfield(value) {
  return String(normalizePermissionBitfield(value))
}

function createPermissionOverwriteQueueKey(channel, overwriteId = null, action = 'set') {
  return [
    `permission-overwrite-${action}`,
    channel?.guildId || channel?.guild?.id || 'unknown-guild',
    channel?.id || 'unknown-channel',
    overwriteId || 'all'
  ].join(':')
}

function getPermissionOverwriteTarget(channel, overwriteId = null) {
  return [
    channel?.guildId || channel?.guild?.id || 'unknown-guild',
    channel?.id || 'unknown-channel',
    overwriteId || 'all'
  ].join(':')
}

module.exports = {
  createPermissionOverwriteSignature,
  editPermissionOverwrite,
  getCachedPermissionOverwrite,
  isFakePermissionOverwriteTargetId,
  isPermissionOverwriteEditNoop,
  normalizePermissionOverwrites,
  setPermissionOverwritesIfChanged
}
