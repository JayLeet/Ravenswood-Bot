const {
  revokeDirectNightAreaAccess
} = require('../channels/revokeDirectNightAreaAccess')
const { queuedVoiceMove } = require('../../../utils/discord/voiceActions')
const {
  createBotLogger
} = require('../../../utils/logger')

const log = createBotLogger({ subsystem: 'AdminGameService' })

class AdminGameService {
  constructor({ errorTypes }) {
    this.errorTypes = errorTypes
  }

  async kickPlayer(manager, guildId, storytellerMember, targetMember) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(this.errorTypes.NOT_FOUND, 'No game')
    if (!manager.isStoryteller(game, storytellerMember.id)) {
      return manager.createError(this.errorTypes.PERMISSION_DENIED, 'Only the Storyteller can kick players')
    }
    if (!targetMember) return manager.createError(this.errorTypes.NOT_FOUND, 'User not found in this server')
    if (manager.getRole(game, targetMember.id) !== 'player') {
      return manager.createError(this.errorTypes.INVALID_STATE, 'Only active players can be kicked')
    }

    const removed = await this.removeDiscordRole(manager, targetMember, 'player')
    if (!removed.ok) return removed

    await disconnectFromVoice(targetMember)

    game.paused = {
      reason: 'player_kicked',
      playerId: targetMember.id,
      kickedBy: storytellerMember.id,
      startedAt: Date.now()
    }
    game.replacementSlot = {
      oldPlayerId: targetMember.id,
      kickedBy: storytellerMember.id,
      createdAt: Date.now()
    }
    game.users[targetMember.id] = {
      ...(game.users[targetMember.id] || {}),
      role: 'player',
      kicked: true,
      kickedAt: Date.now()
    }

    await revokeDirectNightAreaAccess(targetMember.guild, game, targetMember.id)
    await manager.gameManager.restoreNickname(targetMember)
    await manager.emit('PLAYER_KICKED', { game, member: targetMember, storyteller: storytellerMember })
    manager.save()

    return manager.createSuccess({
      kickedPlayerId: targetMember.id,
      paused: true,
      publicMessage: `<@${targetMember.id}> was kicked. The game is paused until a replacement player joins.`,
      storytellerMessage: `<@${storytellerMember.id}> A replacement player is needed to resume the game. Use Requests to approve a join request.`,
      view: manager.serializeGame(game, { guildId })
    })
  }

  substitutePlayer(manager, game, oldPlayerId, requestedMember) {
    const newPlayerId = requestedMember.id
    replaceIdInArray(game.alivePlayers, oldPlayerId, newPlayerId)
    replaceIdInArray(game.deadPlayers, oldPlayerId, newPlayerId)
    moveKey(game.users, oldPlayerId, newPlayerId)
    game.users[newPlayerId] = {
      ...(game.users[newPlayerId] || {}),
      role: 'player',
      substituteFor: oldPlayerId,
      substitutedAt: Date.now()
    }
    delete game.users[newPlayerId].kicked
    delete game.users[newPlayerId].kickedAt
    delete game.users[newPlayerId].left
    delete game.users[newPlayerId].leftAt

    moveKey(game.deadVotes, oldPlayerId, newPlayerId)

    for (const objectName of [
      'demonNotInPlayRoles', 'nightAreaSlots', 'nightChannels',
      'nightInfoPromptMessages', 'nightPromptMessages', 'nightVoiceChannels', 'pendingRoleInfoUpdates',
      'playerMadeVoiceAccess', 'playerMadeVoiceChannels', 'roleHistory',
      'roleInfoPromptMessages', 'roleInfoSent', 'roles', 'shownRoles',
      'statusEffects', 'storytellerMoveRequests', 'substituteBriefings', 'zombuulDeaths'
    ]) moveKey(game[objectName], oldPlayerId, newPlayerId)
    replacePlayerGrimoireIds(game, oldPlayerId, newPlayerId)

    for (const death of game.pendingNightDeaths || []) replaceProperty(death, 'playerId', oldPlayerId, newPlayerId)
    for (const reminder of game.reminders || []) replaceProperty(reminder, 'playerId', oldPlayerId, newPlayerId)
    for (const execution of game.executionHistory || []) replaceProperty(execution, 'playerId', oldPlayerId, newPlayerId)
    for (const vote of game.votes || []) replaceProperty(vote, 'userId', oldPlayerId, newPlayerId)
    for (const request of game.nominationRequests || []) replaceNominationIds(request, oldPlayerId, newPlayerId)
    for (const nomination of game.nominations || []) replaceNominationIds(nomination, oldPlayerId, newPlayerId)
    for (const action of game.nightActions || []) replaceNightActionIds(action, oldPlayerId, newPlayerId)

    replacePlayerIds(game.pendingEndReveal, oldPlayerId, newPlayerId)
    replacePlayerIds(game.pendingManualImpReplacement, oldPlayerId, newPlayerId)
    if (game.executionCandidate) replaceNominationIds(game.executionCandidate, oldPlayerId, newPlayerId)
    if (game.executedPlayer === oldPlayerId) game.executedPlayer = newPlayerId
    if (game.storytellerId === oldPlayerId) game.storytellerId = newPlayerId

    game.paused = null
    game.replacementSlot = null
    return manager.createSuccess()
  }

  async removeUser(manager, guildId, adminMember, targetMember) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(this.errorTypes.NOT_FOUND, 'No game')

    if (!targetMember) return manager.createError(this.errorTypes.NOT_FOUND, 'User not found in this server')

    const userId = targetMember.id
    const role = manager.getRole(game, userId)
    if (!role) return manager.createError(this.errorTypes.INVALID_STATE, 'That user is not in the active game')

    const removed = await this.removeDiscordRole(manager, targetMember, role)
    if (!removed.ok) return removed

    if (role === 'storyteller' && game.storytellerId === userId) game.storytellerId = null

    manager.removePendingRequestsForUser(game, userId)
    if (role === 'player') {
      await manager.cleanupNightChannelForUser(adminMember.guild, game, userId)
      await manager.cleanupNightVoiceChannelForUser(adminMember.guild, game, userId)
      manager.removePlayerFromEngine(game, userId)
    }
    manager.removeUser(game, userId)
    await manager.gameManager.restoreNickname(targetMember)

    await manager.emit('ADMIN_USER_REMOVED', { game, admin: adminMember, member: targetMember, role })
    manager.save()

    return manager.createSuccess({
      removedUserId: userId,
      removedRole: role,
      replacementNeeded: role === 'storyteller',
      view: manager.serializeGame(game, { guildId })
    })
  }

  async forceEnd(manager, guildId, adminMember, reason = null) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(this.errorTypes.NOT_FOUND, 'No game')
    return manager.forceEnd(game, { winner: 'none', reason: reason || `Force-ended by <@${adminMember.id}>` }, adminMember.guild)
  }

  async removeDiscordRole(manager, targetMember, role) {
    if (role === 'player') {
      const roleRemoved = await manager.gameManager.removePlayerRole(targetMember)
      if (!roleRemoved) return manager.createError(this.errorTypes.TRANSACTION_FAILED, 'Could not remove Player role')
    }
    if (role === 'spectator') {
      const roleRemoved = await manager.gameManager.removeSpectatorRole(targetMember)
      if (!roleRemoved) return manager.createError(this.errorTypes.TRANSACTION_FAILED, 'Could not remove Spectator role')
    }
    if (role === 'storyteller') {
      const roleRemoved = await manager.gameManager.removeStorytellerRole(targetMember)
      if (!roleRemoved) return manager.createError(this.errorTypes.TRANSACTION_FAILED, 'Could not remove Storyteller role')
    }
    return manager.createSuccess()
  }
}

async function disconnectFromVoice(member) {
  if (!member?.voice?.channelId) return null
  return queuedVoiceMove(member, null).catch(err => {
    log.recoverable('disconnect-kicked-player-from-voice', err, {
      guildId: member.guild?.id,
      userId: member.id,
      channelId: member.voice.channelId
    })
    return null
  })
}

function moveKey(object, oldKey, newKey) {
  if (!object || !Object.prototype.hasOwnProperty.call(object, oldKey)) return
  object[newKey] = object[oldKey]
  delete object[oldKey]
}

function replaceIdInArray(array, oldId, newId) {
  if (!Array.isArray(array)) return
  const index = array.indexOf(oldId)
  if (index !== -1) array[index] = newId
}

function replaceProperty(object, key, oldId, newId) {
  if (object?.[key] === oldId) object[key] = newId
}

function replaceNominationIds(object, oldId, newId) {
  for (const key of ['nominatorId', 'nomineeId', 'secondedBy', 'resolvedBy', 'playerId', 'userId']) {
    replaceProperty(object, key, oldId, newId)
  }
  replacePlayerIds(object, oldId, newId)
}

function replaceNightActionIds(action, oldId, newId) {
  for (const key of ['actorId', 'playerId', 'targetId', 'userId']) replaceProperty(action, key, oldId, newId)
  replacePlayerIds(action, oldId, newId)
}

function replacePlayerIds(object, oldId, newId) {
  if (!object || typeof object !== 'object') return

  for (const key of ['deadDemonId', 'kickedBy', 'leftBy', 'oldPlayerId', 'playerId', 'requestedBy']) {
    replaceProperty(object, key, oldId, newId)
  }
  for (const key of ['candidates', 'countedVotePlayerIds', 'revealedPlayers', 'targetIds']) {
    if (Array.isArray(object[key])) replaceIdInArray(object[key], oldId, newId)
  }
}

function replacePlayerGrimoireIds(game, oldId, newId) {
  moveKey(game.playerGrimoires, oldId, newId)

  for (const notes of Object.values(game.playerGrimoires || {})) {
    moveKey(notes, oldId, newId)
  }
}

module.exports = AdminGameService
