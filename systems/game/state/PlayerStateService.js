class PlayerStateService {
  getRole(game, userId) {
    return game.users?.[userId]?.role ?? null
  }

  getPlayerIds(game) {
    return Object.entries(game.users || {})
      .filter(([, data]) => data.role === 'player')
      .map(([userId]) => userId)
  }

  isFakePlayer(game, userId) {
    return game.users?.[userId]?.fake === true
  }

  getDisplayName(game, userId) {
    return game.users?.[userId]?.displayName || null
  }

  isStoryteller(game, userId) {
    return game.storytellerId === userId && this.getRole(game, userId) === 'storyteller'
  }

  setRole(game, userId, role) {
    if (!game.users) game.users = {}
    game.users[userId] = { role }
  }

  removeUser(game, userId) {
    if (game.users) delete game.users[userId]
  }

  addAlivePlayer(game, userId) {
    game.alivePlayers ??= []
    game.deadPlayers ??= []
    game.deadPlayers = game.deadPlayers.filter(id => id !== userId)
    if (game.deadVotes) delete game.deadVotes[userId]
    if (!game.alivePlayers.includes(userId)) game.alivePlayers.push(userId)
  }

  addDeadPlayer(game, userId) {
    game.alivePlayers = (game.alivePlayers || []).filter(id => id !== userId)
    game.deadPlayers ??= []
    if (!game.deadPlayers.includes(userId)) game.deadPlayers.push(userId)
    game.deadVotes ??= {}
    game.deadVotes[userId] = true
  }

  removePlayerFromEngine(game, userId) {
    game.alivePlayers = (game.alivePlayers || []).filter(id => id !== userId)
    game.deadPlayers = (game.deadPlayers || []).filter(id => id !== userId)
    game.nominations = (game.nominations || []).filter(nomination =>
      nomination.nomineeId !== userId &&
      nomination.nominatorId !== userId
    )
    game.votes = (game.votes || []).filter(vote => vote.userId !== userId)

    if (game.executedPlayer === userId) game.executedPlayer = null
    if (game.executionCandidate?.nomineeId === userId) game.executionCandidate = null
    if (game.roles) delete game.roles[userId]
    if (game.shownRoles) delete game.shownRoles[userId]
    if (game.roleHistory) delete game.roleHistory[userId]
    if (game.statusEffects) delete game.statusEffects[userId]
    if (game.executionShields?.foolSpent) delete game.executionShields.foolSpent[userId]
    if (game.deadVotes) delete game.deadVotes[userId]
    if (game.nightChannels) delete game.nightChannels[userId]
    if (game.nightPromptMessages) delete game.nightPromptMessages[userId]
    if (game.nightCottageStatusMessages) delete game.nightCottageStatusMessages[userId]
    if (game.nightInfoPromptMessages) delete game.nightInfoPromptMessages[userId]
    if (game.nightInfoNoticeMessages) delete game.nightInfoNoticeMessages[userId]
    if (game.nightVoiceChannels) delete game.nightVoiceChannels[userId]
    if (game.pendingRoleInfoUpdates) delete game.pendingRoleInfoUpdates[userId]
    if (game.playerMadeVoiceAccess) delete game.playerMadeVoiceAccess[userId]
    if (game.playerMadeVoiceChannels) delete game.playerMadeVoiceChannels[userId]
    if (game.roleInfoPromptMessages) delete game.roleInfoPromptMessages[userId]
    if (game.roleInfoSent) delete game.roleInfoSent[userId]
    if (game.playerGrimoires) delete game.playerGrimoires[userId]
    if (game.storytellerMoveRequests) delete game.storytellerMoveRequests[userId]

    for (const notes of Object.values(game.playerGrimoires || {})) {
      delete notes[userId]
    }

    game.pendingNightDeaths = (game.pendingNightDeaths || []).filter(death => death.playerId !== userId)
    if (game.pendingEndReveal?.revealedPlayers) {
      game.pendingEndReveal.revealedPlayers = game.pendingEndReveal.revealedPlayers
        .filter(playerId => playerId !== userId)
    }
    if (game.pendingManualImpReplacement?.deadDemonId === userId) game.pendingManualImpReplacement.deadDemonId = null
    if (game.pendingManualImpReplacement?.requestedBy === userId) game.pendingManualImpReplacement.requestedBy = null
    if (game.pendingManualImpReplacement?.candidates) {
      game.pendingManualImpReplacement.candidates = game.pendingManualImpReplacement.candidates
        .filter(playerId => playerId !== userId)
      if (!game.pendingManualImpReplacement.candidates.length) game.pendingManualImpReplacement = null
    }
  }

  canStepInAsStoryteller(game, userId) {
    return this.getRole(game, userId) !== 'player'
  }

  hasNoPlayers(game) {
    return Object.values(game.users || {})
      .every(user => user.role !== 'player')
  }
}

module.exports = PlayerStateService
