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

function queuedGuildChannelCreate(guild, options) {
  const key = createGuildChannelCreateQueueKey(guild)
  return sharedDiscordActionQueue.run(key, async () => {
    await sharedDiscordActionThrottle.waitTurn(key)
    return runMeasuredChannelAction('channel-create', key, () => guild.channels.create(options))
  })
}

function queuedChannelDelete(channel, reason) {
  const key = createChannelDeleteQueueKey(channel)
  return sharedDiscordActionQueue.run(key, async () => {
    await sharedDiscordActionThrottle.waitTurn(key)
    return runMeasuredChannelAction('channel-delete', key, () => channel.delete(reason))
  })
}

async function runMeasuredChannelAction(action, target, fn) {
  return runMeasuredDiscordAction(action, target, fn, { metrics: sharedDiscordApiMetrics })
}

function createGuildChannelCreateQueueKey(guild) {
  return [
    'channel-create',
    guild?.id || 'unknown-guild'
  ].join(':')
}

function createChannelDeleteQueueKey(channel) {
  return [
    'channel-delete',
    channel?.guildId || channel?.guild?.id || 'unknown-guild',
    channel?.parentId ?? 'no-parent',
    channel?.id || 'unknown-channel'
  ].join(':')
}

module.exports = {
  createChannelDeleteQueueKey,
  createGuildChannelCreateQueueKey,
  queuedChannelDelete,
  queuedGuildChannelCreate
}
