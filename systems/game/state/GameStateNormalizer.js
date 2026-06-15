const {
  normalizePendingEndReveal
} = require('./pendingEndRevealState')
const {
  removeEngineDataForMissingPlayers
} = require('./playerKeyedStateNormalizer')

class GameStateNormalizer {
  normalize(manager, game) {
    const playerIds = manager.getPlayerIds(game)
    const script = manager.resolveScript(game.scriptId || game.script)

    game.scriptId = script.id
    game.script = script.name
    game.day ??= 1
    game.phase = manager.normalizePhase(game)
    game.pendingWin ??= null
    game.pendingEndReveal ??= null
    game.pendingManualImpReplacement ??= null
    game.paused ??= null
    game.replacementSlot ??= null
    game.mastermindFinalDay ??= null
    game.alivePlayers = this.normalizePlayerList(game.alivePlayers, playerIds)
    game.deadPlayers = this.normalizePlayerList(game.deadPlayers, playerIds)

    for (const userId of playerIds) {
      if (
        !game.alivePlayers.includes(userId) &&
        !game.deadPlayers.includes(userId)
      ) {
        game.alivePlayers.push(userId)
      }
    }

    game.nominations ??= []
    game.nominationRequests ??= []
    game.executionHistory ??= []
    game.executedPlayer ??= null
    game.executionCandidate ??= null
    game.executionShields ??= {}
    game.executionShields.foolSpent ??= {}
    game.nightActions ??= []
    game.pendingNightDeaths ??= []
    game.nightChannels ??= {}
    game.nightVoiceChannels ??= {}
    game.nightPromptMessages ??= {}
    game.nightCottageStatusMessages ??= {}
    game.nightInfoPromptMessages ??= {}
    game.nightInfoNoticeMessages ??= {}
    game.nightAreaSlots ??= {}
    game.pendingRoleInfoUpdates ??= {}
    game.storytellerDenChannelId ??= null
    game.townsquareChannelId ??= null
    game.privateConversationCreatorChannelId ??= null
    game.playerMadeVoiceChannels ??= {}
    game.playerMadeVoiceAccess ??= {}
    game.publicDaySideChannelIds ??= {}
    game.votes ??= []
    game.deadVotes ??= {}
    game.demonNotInPlayRoles ??= {}
    game.zombuulDeaths ??= {}
    game.roles ??= {}
    game.shownRoles ??= {}
    game.lunaticInfo ??= {}
    game.roleHistory ??= {}
    game.roleCategories = manager.createDefaultRoleCategories(game.scriptId)
    game.roleInfoPromptMessages ??= {}
    game.roleInfoSent ??= {}
    game.playerGrimoires ??= {}
    game.storytellerMoveRequests ??= {}
    game.reminders ??= []
    game.statusEffects ??= {}

    this.normalizeDeadVotes(game, playerIds)
    this.normalizeReplacementState(game, playerIds)
    normalizePendingEndReveal(game, playerIds)
    this.normalizePendingManualImpReplacement(manager, game, playerIds)
    this.normalizePendingNightDeaths(game, playerIds)
    this.normalizePlayerMessageRefs(game.nightPromptMessages, playerIds)
    this.normalizePlayerMessageRefs(game.nightCottageStatusMessages, playerIds)
    this.normalizePlayerMessageRefGroups(game.nightInfoPromptMessages, playerIds)
    this.normalizePlayerMessageRefs(game.nightInfoNoticeMessages, playerIds)
    this.normalizePlayerMessageRefs(game.roleInfoPromptMessages, playerIds)
    this.normalizeStorytellerMoveRequests(game, playerIds)
    manager.normalizeGrimReminders(game, playerIds)
    removeEngineDataForMissingPlayers(manager, game, playerIds)
    manager.removeRolesOutsideScript(game)
    manager.normalizeVotingState(game, playerIds)
  }

  normalizePlayerList(userIds, playerIds) {
    const allowed = new Set(playerIds)
    return [...new Set(userIds || [])].filter(userId => allowed.has(userId))
  }

  normalizeDeadVotes(game, playerIds) {
    const allowed = new Set(playerIds)

    for (const userId of Object.keys(game.deadVotes || {})) {
      if (!allowed.has(userId)) delete game.deadVotes[userId]
    }

    for (const userId of Object.keys(game.zombuulDeaths || {})) {
      if (!allowed.has(userId)) delete game.zombuulDeaths[userId]
    }

    for (const userId of game.deadPlayers || []) {
      if (game.deadVotes[userId] === undefined) game.deadVotes[userId] = true
    }

    for (const userId of game.alivePlayers || []) {
      delete game.deadVotes[userId]
    }
  }

  removeEngineDataForMissingPlayers(manager, game, playerIds) {
    return removeEngineDataForMissingPlayers(manager, game, playerIds)
  }

  normalizeReplacementState(game, playerIds) {
    const allowed = new Set(playerIds)

    if (game.replacementSlot) {
      const oldPlayerId = game.replacementSlot.oldPlayerId || game.replacementSlot.playerId || null
      if (!oldPlayerId || !allowed.has(oldPlayerId)) {
        game.replacementSlot = null
      } else {
        game.replacementSlot.oldPlayerId = oldPlayerId
      }
    }

    if (game.paused) {
      const pausedPlayerId = game.paused.playerId || game.replacementSlot?.oldPlayerId || null
      if (!pausedPlayerId || !allowed.has(pausedPlayerId)) {
        game.paused = null
      } else {
        game.paused.playerId = pausedPlayerId
      }
    }
  }

  normalizePendingManualImpReplacement(manager, game, playerIds) {
    const pending = game.pendingManualImpReplacement
    if (!pending) return

    const allowed = new Set(playerIds)
    const alive = new Set(game.alivePlayers || [])
    const candidates = [...new Set(pending.candidates || [])].filter(userId =>
      allowed.has(userId) &&
      alive.has(userId) &&
      manager.scripts.getRole(game.scriptId, game.roles?.[userId])?.team === 'minion'
    )

    if (!pending.id || !candidates.length) {
      game.pendingManualImpReplacement = null
      return
    }

    pending.candidates = candidates
    pending.deadDemonId ??= pending.deadPlayerId || null
    pending.requestedAt ??= pending.createdAt || null
    pending.requestedBy ??= pending.createdBy || null
    if (pending.deadDemonId && !allowed.has(pending.deadDemonId)) pending.deadDemonId = null
    if (pending.requestedBy && !game.users?.[pending.requestedBy]) pending.requestedBy = null
    delete pending.deadPlayerId
    delete pending.createdAt
    delete pending.createdBy
  }

  normalizePendingNightDeaths(game, playerIds) {
    const allowed = new Set(playerIds)
    game.pendingNightDeaths = (game.pendingNightDeaths || [])
      .filter(death => allowed.has(death?.playerId))
      .map(death => ({
        ...death,
        day: death.day || game.day || 1
      }))
  }

  normalizePlayerMessageRefs(refs, playerIds) {
    const allowed = new Set(playerIds)
    for (const [playerId, ref] of Object.entries(refs || {})) {
      const normalized = normalizeTrackedMessageRef(ref)
      if (!allowed.has(playerId) || !normalized) delete refs[playerId]
      else refs[playerId] = normalized
    }
  }

  normalizePlayerMessageRefGroups(refGroups, playerIds) {
    const allowed = new Set(playerIds)
    for (const [playerId, refs] of Object.entries(refGroups || {})) {
      if (!allowed.has(playerId) || !isPlainObject(refs)) {
        delete refGroups[playerId]
        continue
      }

      for (const [key, ref] of Object.entries(refs)) {
        const normalized = normalizeTrackedMessageRef(ref)
        if (!normalized) delete refs[key]
        else refs[key] = normalized
      }
      if (!Object.keys(refs).length) delete refGroups[playerId]
    }
  }

  normalizeStorytellerMoveRequests(game, playerIds) {
    const allowed = new Set(playerIds)
    if (!isPlainObject(game.storytellerMoveRequests)) {
      game.storytellerMoveRequests = {}
      return
    }

    for (const [playerId, request] of Object.entries(game.storytellerMoveRequests)) {
      if (!allowed.has(playerId) || !isPlainObject(request)) {
        delete game.storytellerMoveRequests[playerId]
        continue
      }

      const storyteller = normalizeTrackedMessageRef(request.storyteller)
      const playerNotice = normalizeTrackedMessageRef(request.playerNotice)
      if (storyteller) request.storyteller = storyteller
      else delete request.storyteller
      if (playerNotice) request.playerNotice = playerNotice
      else delete request.playerNotice

      if (!request.storyteller && !request.playerNotice) delete game.storytellerMoveRequests[playerId]
    }
  }
}

function normalizeTrackedMessageRef(ref) {
  if (!ref?.channelId || !ref?.messageId) return null
  return {
    channelId: String(ref.channelId),
    messageId: String(ref.messageId)
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

module.exports = GameStateNormalizer
