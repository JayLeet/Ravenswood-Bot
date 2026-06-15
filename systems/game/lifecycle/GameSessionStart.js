const phases = require('../phases')
const {
  isClocktowerLiveMode
} = require('../../../utils/gameModes')
const {
  shouldUseClocktowerLiveRoleVisuals
} = require('../../../utils/clocktowerLiveRoles')
const {
  createClocktowerLiveFirstNightInfo
} = require('./ClocktowerLiveRoleVisuals')

const MIN_PLAYERS = 5
const MAX_PLAYERS = 15

async function startGame(service, manager, guildId, member) {
  const game = manager.get(guildId)
  if (!game) return manager.createError(service.errorTypes.NOT_FOUND, 'No game')

  if (!manager.isStoryteller(game, member.id)) {
    return manager.createError(service.errorTypes.PERMISSION_DENIED, 'Not storyteller')
  }

  if (game.state === 'in-game') {
    return manager.createError(service.errorTypes.INVALID_STATE, 'Game is already in progress')
  }

  const playerIds = manager.getPlayerIds(game)
  const playerCount = playerIds.length
  const valid = validatePlayerCount(service, manager, game, playerCount)
  if (!valid.ok) return valid
  const rolesValid = validatePlayerRoles(service, manager, game, playerIds)
  if (!rolesValid.ok) return rolesValid

  if (game.phase !== 'lobby') {
    const recovered = phases.recoverPhase(game, 'lobby', { reason: 'start-normalize-lobby' })
    if (!recovered.ok) {
      return manager.createError(service.errorTypes.INVALID_STATE, recovered.error, {
        from: recovered.from,
        to: recovered.to
      })
    }
  }

  const old = game.state
  const seatedPlayerIds = assignRandomPlayerSeats(game, playerIds, service.random)
  resetGameForStart(game, seatedPlayerIds)

  const transition = phases.transitionGame(game, 'night', { reason: 'game-start' })
  if (!transition.ok) {
    return manager.createError(service.errorTypes.INVALID_STATE, transition.error, {
      from: transition.from,
      to: transition.to
    })
  }

  await manager.emit('STATE_CHANGED', { game, from: old, to: 'in-game' })
  await manager.emit('PHASE_CHANGED', {
    game,
    from: transition.transition.from,
    to: transition.transition.to,
    transition: transition.transition
  })
  await manager.emit('GAME_STARTED', { game, member })

  if (isClocktowerLiveMode(game)) {
    await createClocktowerLiveFirstNightInfo(manager, game, member)
  } else {
    await manager.roleEngine.handlePhaseStart(manager, game, transition.transition, {
      createdBy: member.id,
      reason: 'game-start'
    })
  }

  manager.save()

  return manager.createSuccess({
    view: service.serializeView(manager, game, guildId)
  })
}

function validatePlayerRoles(service, manager, game, playerIds) {
  if (isClocktowerLiveMode(game)) return manager.createSuccess()

  const missing = playerIds.filter(playerId => !game.roles?.[playerId])
  if (missing.length) {
    return manager.createError(
      service.errorTypes.INVALID_STATE,
      `Assign roles to every player before starting. Missing: ${missing.length}.`
    )
  }

  const invalid = playerIds.filter(playerId => !manager.scripts.getRole(game.scriptId, game.roles[playerId]))
  if (invalid.length) {
    return manager.createError(
      service.errorTypes.INVALID_STATE,
      `Fix invalid role assignments before starting. Invalid: ${invalid.length}.`
    )
  }

  return manager.createSuccess()
}

function validatePlayerCount(service, manager, game, playerCount) {
  if (!game.testMode && playerCount < MIN_PLAYERS) {
    return manager.createError(
      service.errorTypes.INVALID_STATE,
      `A game needs at least ${MIN_PLAYERS} players, excluding the Storyteller and spectators.`
    )
  }

  if (playerCount > MAX_PLAYERS) {
    return manager.createError(
      service.errorTypes.INVALID_STATE,
      `A game can have at most ${MAX_PLAYERS} players, excluding the Storyteller and spectators.`
    )
  }

  if (!playerCount) {
    return manager.createError(service.errorTypes.INVALID_STATE, 'Add at least one player before starting')
  }

  return manager.createSuccess()
}

function resetGameForStart(game, playerIds) {
  game.state = 'in-game'
  game.day = 1
  game.pendingWin = null
  game.mastermindFinalDay = null
  game.startedAt = Date.now()
  game.alivePlayers = [...playerIds]
  game.deadPlayers = []
  game.demonNotInPlayRoles = {}
  game.zombuulDeaths = {}
  game.nominations = []
  game.executedPlayer = null
  game.executionCandidate = null
  game.nightActions = []
  game.nightChannels = {}
  game.nightVoiceChannels = {}
  game.nightAreaSlots = {}
  game.nightCottageStatusMessages = {}
  game.nightInfoPromptMessages = {}
  game.nightInfoNoticeMessages = {}
  game.nightPromptMessages = {}
  game.pendingRoleInfoUpdates = {}
  game.privateConversationCreatorChannelId = null
  game.playerMadeVoiceChannels = {}
  game.playerMadeVoiceAccess = {}
  game.roleInfoPromptMessages = {}
  game.roleInfoSent = {}
  game.votes = []
  game.deadVotes = {}
}

function assignRandomPlayerSeats(game, playerIds, random = Math.random) {
  const seatedPlayerIds = shufflePlayerIds(playerIds, random)
  reorderGamePlayers(game, seatedPlayerIds)
  return seatedPlayerIds
}

function shufflePlayerIds(playerIds, random = Math.random) {
  const ids = [...playerIds]
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const nextRandom = Number(random())
    const safeRandom = Number.isFinite(nextRandom) ? Math.min(Math.max(nextRandom, 0), 0.999999999) : 0
    const swapIndex = Math.floor(safeRandom * (index + 1))
    const current = ids[index]
    ids[index] = ids[swapIndex]
    ids[swapIndex] = current
  }
  return ids
}

function reorderGamePlayers(game, seatedPlayerIds) {
  const users = game.users || {}
  const seated = new Set(seatedPlayerIds)
  const nextUsers = {}

  for (const [userId, user] of Object.entries(users)) {
    if (user.role !== 'player') nextUsers[userId] = user
  }

  for (const userId of seatedPlayerIds) {
    if (users[userId]) nextUsers[userId] = users[userId]
  }

  for (const [userId, user] of Object.entries(users)) {
    if (user.role === 'player' && !seated.has(userId)) nextUsers[userId] = user
  }

  game.users = nextUsers
}

module.exports = {
  MAX_PLAYERS,
  MIN_PLAYERS,
  assignRandomPlayerSeats,
  startGame,
  shufflePlayerIds,
  validatePlayerRoles,
  validatePlayerCount,
  shouldUseClocktowerLiveRoleVisuals
}
