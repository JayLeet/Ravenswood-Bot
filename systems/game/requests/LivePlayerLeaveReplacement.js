const {
  revokeDirectNightAreaAccess
} = require('../channels/revokeDirectNightAreaAccess')
const {
  queuedVoiceMove
} = require('../../../utils/discord/voiceActions')
const {
  createBotLogger
} = require('../../../utils/logger')

const log = createBotLogger({ subsystem: 'LivePlayerLeaveReplacement' })

async function leaveLivePlayerForReplacement({ requests, manager, guildId, game, member, errorTypes }) {
  const userId = member.id
  const existingReplacement = game.replacementSlot?.oldPlayerId
  if (existingReplacement && existingReplacement !== userId) {
    return manager.createError(
      errorTypes.INVALID_STATE,
      'A different player already needs a replacement.'
    )
  }

  if (existingReplacement === userId) {
    return manager.createSuccess({
      message: 'You are already marked as needing a replacement.',
      paused: true,
      view: manager.serializeGame(game, { guildId })
    })
  }

  const roleRemoved = await manager.gameManager.removePlayerRole(member)
  if (!roleRemoved) {
    return manager.createError(
      errorTypes.TRANSACTION_FAILED,
      'Could not remove Player role'
    )
  }

  await disconnectFromVoice(member)
  requests.removePendingRequestsForUser(game, userId)

  const now = Date.now()
  game.paused = {
    reason: 'player_left',
    playerId: userId,
    startedAt: now
  }
  game.replacementSlot = {
    oldPlayerId: userId,
    leftBy: userId,
    createdAt: now,
    reason: 'player_left'
  }
  game.users[userId] = {
    ...(game.users[userId] || {}),
    role: 'player',
    left: true,
    leftAt: now
  }

  await revokeDirectNightAreaAccess(member.guild, game, userId)
  await manager.gameManager.restoreNickname(member)
  await manager.emit('PLAYER_LEFT', { game, member, replacementNeeded: true })
  manager.save()

  return manager.createSuccess({
    message: 'You left the game. The game is paused until a replacement player joins.',
    paused: true,
    publicMessage: `<@${userId}> left. The game is paused until a replacement player joins.`,
    storytellerMessage: `<@${game.storytellerId}> A replacement player is needed to resume the game. Use Requests to approve a join request.`,
    view: manager.serializeGame(game, { guildId })
  })
}

async function disconnectFromVoice(member) {
  if (!member?.voice?.channelId) return null
  return queuedVoiceMove(member, null).catch(err => {
    log.recoverable('disconnect-left-player-from-voice', err, {
      guildId: member.guild?.id,
      userId: member.id,
      channelId: member.voice.channelId
    })
    return null
  })
}

module.exports = {
  leaveLivePlayerForReplacement
}
