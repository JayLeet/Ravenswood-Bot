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

function setChannelNameIfChanged(channel, name, reason) {
  const action = 'channel-name-set'
  const target = getChannelTarget(channel)
  if (!channel || channel.name === name || typeof channel.setName !== 'function') {
    sharedDiscordApiMetrics.skipped(action, { target })
    return Promise.resolve(false)
  }

  return runQueuedChannelStateAction(channel, action, () => channel.setName(name, reason))
}

function setVoiceChannelStatusIfChanged(channel, status, reason) {
  const action = 'voice-channel-status-set'
  const target = getChannelTarget(channel)
  const nextStatus = normalizeVoiceChannelStatus(status)
  if (!channel || getKnownVoiceChannelStatus(channel) === nextStatus || !canSetVoiceChannelStatus(channel)) {
    sharedDiscordApiMetrics.skipped(action, { target })
    return Promise.resolve(false)
  }

  return runQueuedChannelStateAction(channel, action, async () => {
    if (typeof channel.setStatus === 'function') {
      await channel.setStatus(nextStatus, reason)
    } else {
      await getChannelRestClient(channel).put(`/channels/${channel.id}/voice-status`, {
        body: { status: nextStatus },
        reason
      })
    }
    channel.status = nextStatus
  })
}

function setChannelParentIfChanged(channel, parentId, options = {}) {
  const action = 'channel-parent-set'
  const target = getChannelTarget(channel)
  const nextParentId = parentId ?? null
  if (!channel || channel.parentId === nextParentId || typeof channel.setParent !== 'function') {
    sharedDiscordApiMetrics.skipped(action, { target })
    return Promise.resolve(false)
  }

  return runQueuedChannelStateAction(channel, action, () => channel.setParent(nextParentId, options))
}

function setChannelPosition(channel, position, options = {}) {
  const action = 'channel-position-set'
  const target = getChannelTarget(channel)
  if (!channel || !Number.isFinite(position) || typeof channel.setPosition !== 'function') {
    sharedDiscordApiMetrics.skipped(action, { target })
    return Promise.resolve(false)
  }

  return runQueuedChannelStateAction(channel, action, () => channel.setPosition(position, options))
}

function setChannelPositionIfChanged(channel, position, options = {}) {
  const action = 'channel-position-set'
  const target = getChannelTarget(channel)
  if (getChannelPosition(channel) === position) {
    sharedDiscordApiMetrics.skipped(action, { target })
    return Promise.resolve(false)
  }

  return setChannelPosition(channel, position, options)
}

function setGuildChannelPositionsIfChanged(guild, positions, options = {}) {
  const action = 'guild-channel-positions-set'
  const target = getGuildTarget(guild)
  const normalized = (positions || []).filter(item => item?.channel)
  if (!normalized.length || typeof guild?.channels?.setPositions !== 'function') {
    sharedDiscordApiMetrics.skipped(action, { target })
    return Promise.resolve(false)
  }

  if (normalized.every(item => getCachedChannelPosition(guild, item.channel) === item.position)) {
    sharedDiscordApiMetrics.skipped(action, { target })
    return Promise.resolve(false)
  }

  const key = createGuildChannelPositionsQueueKey(guild)
  return sharedDiscordActionQueue.run(key, async () => {
    await sharedDiscordActionThrottle.waitTurn(key)
    return runMeasuredChannelStateAction(action, target, async () => {
      await guild.channels.setPositions(normalized, options)
      return true
    })
  })
}

function runQueuedChannelStateAction(channel, action, write) {
  const key = createChannelStateQueueKey(channel, action)
  const target = getChannelTarget(channel)
  return sharedDiscordActionQueue.run(key, async () => {
    await sharedDiscordActionThrottle.waitTurn(key)
    return runMeasuredChannelStateAction(action, target, async () => {
      await write()
      return true
    })
  })
}

async function runMeasuredChannelStateAction(action, target, fn) {
  return runMeasuredDiscordAction(action, target, fn, { metrics: sharedDiscordApiMetrics })
}

function getCachedChannelPosition(guild, channelId) {
  const channel = getCachedChannel(guild, channelId)
  return getChannelPosition(channel)
}

function getCachedChannel(guild, channelId) {
  const cache = guild?.channels?.cache
  if (typeof cache?.get === 'function') return cache.get(channelId) || null
  if (Array.isArray(cache)) return cache.find(channel => channel.id === channelId) || null
  if (typeof cache?.values === 'function') {
    return [...cache.values()].find(channel => channel.id === channelId) || null
  }
  return null
}

function getChannelPosition(channel) {
  const value = channel?.rawPosition ?? channel?.position
  return Number.isFinite(value) ? value : null
}

function createChannelStateQueueKey(channel) {
  return [
    'channel-state-write',
    channel?.guildId || channel?.guild?.id || 'unknown-guild',
    channel?.id || 'unknown-channel'
  ].join(':')
}

function createGuildChannelPositionsQueueKey(guild) {
  return ['guild-channel-positions-set', guild?.id || 'unknown-guild'].join(':')
}

function getChannelTarget(channel) {
  return [
    channel?.guildId || channel?.guild?.id || 'unknown-guild',
    channel?.id || 'unknown-channel'
  ].join(':')
}

function getGuildTarget(guild) {
  return guild?.id || 'unknown-guild'
}

function canSetVoiceChannelStatus(channel) {
  return typeof channel?.setStatus === 'function' ||
    Boolean(channel?.id && typeof getChannelRestClient(channel)?.put === 'function')
}

function getKnownVoiceChannelStatus(channel) {
  return normalizeVoiceChannelStatus(channel?.status ?? channel?.voiceStatus)
}

function getChannelRestClient(channel) {
  return channel?.client?.rest || channel?.guild?.client?.rest || null
}

function normalizeVoiceChannelStatus(status) {
  const value = String(status || '').trim()
  return value ? value.slice(0, 500) : null
}

module.exports = {
  createChannelStateQueueKey,
  getChannelPosition,
  getChannelTarget,
  setChannelNameIfChanged,
  setChannelParentIfChanged,
  setChannelPositionIfChanged,
  setGuildChannelPositionsIfChanged,
  setVoiceChannelStatusIfChanged
}
