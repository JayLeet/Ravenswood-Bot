const {
  sharedDiscordApiMetrics
} = require('../../../../utils/discord/apiMetrics')
const {
  queuedVoiceMove
} = require('../../../../utils/discord/voiceActions')
const {
  createBotLogger
} = require('../../../../utils/logger')
const {
  fetchGuildMemberWithRecoverableFallback
} = require('../../../../utils/discord/recoverableFetch')
const {
  getDiscordErrorReason
} = require('../../../../utils/discord/errorReason')

const log = createBotLogger({ subsystem: 'VoiceMovement' })

async function movePlayersToNightVoiceChannels(guild, gameLifecycle, game, channels, onlyUserId = null) {
  const summary = createMovementSummary()

  for (const playerId of gameLifecycle.getPlayerIds(game)) {
    if (onlyUserId && playerId !== onlyUserId) continue
    if (gameLifecycle.isFakePlayer?.(game, playerId)) continue

    const channel = channels.get(playerId)
    if (!channel) {
      summary.missingChannel.push(playerId)
      continue
    }

    await movePlayerToVoiceChannel(guild, playerId, channel, summary)
  }

  return summary
}

async function movePlayersToVoiceChannel(guild, playerIds, channel, onlyUserId = null) {
  const summary = createMovementSummary()

  for (const playerId of playerIds) {
    if (onlyUserId && playerId !== onlyUserId) continue
    await movePlayerToVoiceChannel(guild, playerId, channel, summary)
  }

  return summary
}

async function movePlayerToVoiceChannel(guild, playerId, channel, summary = createMovementSummary()) {
  const member = await fetchGuildMemberWithRecoverableFallback({
    action: 'fetch-voice-move-member',
    context: { channelId: channel?.id },
    guild,
    logger: log,
    userId: playerId
  })
  if (!member?.voice?.channelId) {
    summary.skippedDisconnected.push(playerId)
    sharedDiscordApiMetrics.skipped('voice-move', { target: createVoiceMoveTarget(guild, playerId, channel) })
    return false
  }

  if (member.voice.channelId === channel.id) {
    summary.alreadyMoved.push(playerId)
    await queuedVoiceMove(member, channel)
    return true
  }

  return queuedVoiceMove(member, channel)
    .then(() => {
      summary.moved.push(playerId)
      return true
    })
    .catch(err => {
      const reason = getDiscordErrorReason(err)
      const hint = createVoiceMoveHint(reason)
      summary.failed.push({ playerId, channelId: channel.id, reason, hint })
      log.warn('move-player-to-voice-channel', createVoiceMoveWarning(playerId, channel, reason, hint), {
        channelId: channel.id,
        playerId
      })
      return false
    })
}

function createVoiceMoveQueueKey(guild, channel) {
  return ['voice-move', guild?.id || 'unknown-guild', channel?.parentId || channel?.id || 'unknown-channel'].join(':')
}

function createVoiceMoveTarget(guild, playerId, channel) {
  return [
    guild?.id || 'unknown-guild',
    playerId || 'unknown-player',
    channel?.id || 'unknown-channel'
  ].join(':')
}

function createMovementSummary() {
  return {
    moved: [],
    alreadyMoved: [],
    skippedDisconnected: [],
    missingChannel: [],
    failed: []
  }
}

function createVoiceMoveWarning(playerId, channel, reason, hint = createVoiceMoveHint(reason)) {
  return [
    `[BOTC] Could not move ${playerId} to ${channel.name || channel.id}: ${reason}`,
    `Likely fix: ${hint}`,
    'The game will continue; this only means the player must join the cottage manually.'
  ].join(' ')
}

function createVoiceMoveHint(reason = '') {
  const normalized = String(reason).toLowerCase()

  if (normalized.includes('missing permissions') || normalized.includes('blocked')) {
    return [
      'give the bot Move Members, View Channel, and Connect permissions in the source and target voice channels;',
      'make sure the bot role is above player roles it needs to move;',
      'Discord may still block moving the server owner or users above the bot role.'
    ].join(' ')
  }

  if (normalized.includes('unknown member') || normalized.includes('unknown user')) {
    return 'the player may have left the server or Discord could not find them.'
  }

  return 'check the bot voice permissions and role hierarchy.'
}

module.exports = {
  createMovementSummary,
  createVoiceMoveHint,
  createVoiceMoveQueueKey,
  createVoiceMoveTarget,
  createVoiceMoveWarning,
  getDiscordErrorReason,
  movePlayerToVoiceChannel,
  movePlayersToNightVoiceChannels,
  movePlayersToVoiceChannel
}
