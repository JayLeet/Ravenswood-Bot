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

function queuedVoiceMove(member, channel) {
  const key = createVoiceMoveQueueKey(member, channel)
  return sharedDiscordActionQueue.run(key, async () => {
    const target = getVoiceMoveTarget(member, channel)
    if (channel?.id && member?.voice?.channelId === channel.id) {
      sharedDiscordApiMetrics.skipped('voice-move', { target })
      return { ok: true, skipped: true, member, channel }
    }

    await sharedDiscordActionThrottle.waitTurn(key)
    return runMeasuredVoiceMove(target, async () => {
      await member.voice.setChannel(channel)
      return { ok: true, skipped: false, member, channel }
    })
  })
}

async function runMeasuredVoiceMove(target, fn) {
  return runMeasuredDiscordAction('voice-move', target, fn, { metrics: sharedDiscordApiMetrics })
}

function createVoiceMoveQueueKey(member, channel) {
  return [
    'voice-move',
    getVoiceMoveGuildId(member, channel),
    member?.id || 'unknown-member'
  ].join(':')
}

function getVoiceMoveTarget(member, channel) {
  return [
    getVoiceMoveGuildId(member, channel),
    member?.id || 'unknown-member',
    member?.voice?.channelId || 'no-current-channel',
    channel?.id || 'unknown-channel'
  ].join(':')
}

function getVoiceMoveGuildId(member, channel) {
  return member?.guildId ||
    member?.guild?.id ||
    channel?.guildId ||
    channel?.guild?.id ||
    'unknown-guild'
}

module.exports = {
  createVoiceMoveQueueKey,
  getVoiceMoveTarget,
  queuedVoiceMove
}
