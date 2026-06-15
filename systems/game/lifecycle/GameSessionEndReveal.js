const {
  isClocktowerLiveMode
} = require('../../../utils/gameModes')
const {
  hasCompleteValidRoles
} = require('../../../utils/clocktowerLiveRoles')
const {
  fetchGuildMemberWithRecoverableFallback
} = require('../../../utils/discord/recoverableFetch')
const {
  createBotLogger
} = require('../../../utils/logger')

const log = createBotLogger({ subsystem: 'EndReveal' })

async function openEndReveal(service, manager, guildId, member) {
  const game = manager.get(guildId)
  if (!game) return manager.createError(service.errorTypes.NOT_FOUND, 'No game')

  if (!manager.isStoryteller(game, member.id)) {
    return manager.createError(service.errorTypes.PERMISSION_DENIED, 'Not storyteller')
  }

  if (game.state === 'lobby' && manager.hasNoPlayers(game)) {
    return service.forceEnd(manager, game, {
      winner: 'none',
      reason: 'Ended by ' + mention(member.id)
    }, member.guild)
  }

  const forcedWin = manager.winConditions?.getRevealLock?.(manager, game) ||
    service.evaluateWinConditions(manager, game, { preview: true })
  const reveal = {
    id: `${Date.now()}-${member.id}`,
    requestedBy: member.id,
    requestedAt: Date.now(),
    state: game.state,
    phase: game.phase,
    day: game.day || 1,
    status: 'pending',
    forcedWinner: forcedWin?.winner || null,
    forcedReason: forcedWin?.reason || null,
    revealedPlayers: [],
    skipPlayerReveal: shouldSkipPlayerReveal(manager, game)
  }

  game.pendingEndReveal = reveal
  manager.save()

  return manager.createSuccess({
    reveal,
    view: serializeView(manager, game, guildId)
  })
}

async function revealGrimPlayer(service, manager, guildId, member, playerId, revealId) {
  const game = manager.get(guildId)
  if (!game) return manager.createError(service.errorTypes.NOT_FOUND, 'No game')

  const valid = validateEndReveal(service, manager, game, member, revealId)
  if (!valid.ok) return valid

  if (valid.reveal.skipPlayerReveal) {
    return manager.createError(
      service.errorTypes.INVALID_STATE,
      'Player reveal is disabled in Clocktower.live mode unless every player has a valid assigned role.'
    )
  }

  if (!manager.getPlayerIds(game).includes(playerId)) {
    return manager.createError(service.errorTypes.INVALID_STATE, 'That player is not in this game.')
  }

  valid.reveal.revealedPlayers ??= []
  if (!valid.reveal.revealedPlayers.includes(playerId)) {
    valid.reveal.revealedPlayers.push(playerId)
  }

  await updateRevealedPlayerNickname(manager, game, member.guild, playerId)

  if (isRevealComplete(game, valid.reveal) && valid.reveal.winner) {
    return forceEndAfterCompleteReveal(service, manager, game, valid.reveal, member, guildId)
  }

  manager.save()

  return manager.createSuccess({
    reveal: valid.reveal,
    view: serializeView(manager, game, guildId)
  })
}

function cancelEndReveal(service, manager, guildId, member, revealId) {
  const game = manager.get(guildId)
  if (!game) return manager.createError(service.errorTypes.NOT_FOUND, 'No game')

  const valid = validateEndReveal(service, manager, game, member, revealId)
  if (!valid.ok) return valid

  if ((valid.reveal.revealedPlayers || []).length) {
    return manager.createError(
      service.errorTypes.INVALID_STATE,
      'The Grimoire reveal cannot be cancelled after a player has been revealed.'
    )
  }

  game.pendingEndReveal = null
  manager.save()

  return manager.createSuccess({
    message: 'End-game reveal cancelled. The game continues.'
  })
}

async function endGameWithWinner(service, manager, guildId, member, winner, revealId = null) {
  const game = manager.get(guildId)
  if (!game) return manager.createError(service.errorTypes.NOT_FOUND, 'No game')

  const valid = validateEndReveal(service, manager, game, member, revealId)
  if (!valid.ok) return valid

  if (!valid.reveal.skipPlayerReveal && !(valid.reveal.revealedPlayers || []).length) {
    return manager.createError(
      service.errorTypes.INVALID_STATE,
      'Reveal at least one role before choosing the winning team.'
    )
  }

  if (valid.reveal.winner) {
    return manager.createError(
      service.errorTypes.INVALID_STATE,
      'The winning team has already been revealed.'
    )
  }

  if (valid.reveal.forcedWinner && winner !== valid.reveal.forcedWinner) {
    return manager.createError(
      service.errorTypes.INVALID_STATE,
      `This ending is locked to the ${valid.reveal.forcedWinner} team.`
    )
  }

  valid.reveal.winner = winner
  valid.reveal.winnerRevealedAt = Date.now()
  game.winner = winner
  game.winReason = `Chosen by ${mention(member.id)}`

  if (valid.reveal.skipPlayerReveal || isRevealComplete(game, valid.reveal)) {
    return forceEndAfterCompleteReveal(service, manager, game, valid.reveal, member, guildId)
  }

  manager.save()

  return manager.createSuccess({
    reveal: valid.reveal,
    revealComplete: false,
    view: serializeView(manager, game, guildId),
    winner,
    reason: game.winReason
  })
}

async function forceEndAfterCompleteReveal(service, manager, game, reveal, member, guildId) {
  const view = serializeView(manager, game, guildId)
  const result = await service.forceEnd(manager, game, {
    winner: reveal.winner,
    reason: game.winReason || `Chosen by ${mention(member.id)}`
  }, member.guild)

  if (!result.ok) return result

  return manager.createSuccess({
    ...result,
    reveal,
    revealComplete: true,
    view
  })
}

function validateEndReveal(service, manager, game, member, revealId) {
  if (!manager.isStoryteller(game, member.id)) {
    return manager.createError(
      service.errorTypes.PERMISSION_DENIED,
      'Only the current Storyteller can reveal the winner.'
    )
  }

  const reveal = game.pendingEndReveal
  if (!reveal || reveal.status !== 'pending' || (revealId && reveal.id !== revealId)) {
    return manager.createError(
      service.errorTypes.INVALID_STATE,
      'That end-game reveal prompt is no longer active.'
    )
  }

  return manager.createSuccess({ reveal })
}

function isRevealComplete(game, reveal) {
  const playerIds = Object.entries(game.users || {})
    .filter(([, user]) => user.role === 'player')
    .map(([userId]) => userId)
  if (!playerIds.length) return false

  const revealed = new Set(reveal.revealedPlayers || [])
  return playerIds.every(playerId => revealed.has(playerId))
}

async function updateRevealedPlayerNickname(manager, game, guild, playerId) {
  if (!guild?.members?.fetch || game.users?.[playerId]?.fake) return
  const member = await fetchGuildMemberWithRecoverableFallback({
    action: 'fetch-revealed-player-member',
    guild,
    logger: log,
    userId: playerId
  })
  if (!member) return
  return manager.gameManager?.setGameNickname?.(member, game, playerId)
}

function shouldSkipPlayerReveal(manager, game) {
  return isClocktowerLiveMode(game) && !hasCompleteValidRoles(manager, game)
}

function serializeView(manager, game, guildId) {
  if (typeof manager.serializeGame === 'function') {
    return manager.serializeGame(game, { guildId })
  }
  return null
}

function mention(userId) {
  return '<' + '@' + userId + '>'
}

module.exports = {
  cancelEndReveal,
  endGameWithWinner,
  isRevealComplete,
  openEndReveal,
  revealGrimPlayer,
  serializeView,
  shouldSkipPlayerReveal,
  updateRevealedPlayerNickname,
  validateEndReveal
}
