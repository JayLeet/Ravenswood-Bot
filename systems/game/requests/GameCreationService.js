const {
  GAME_MODE,
  isClocktowerLiveMode
} = require('../../../utils/gameModes')

class GameCreationService {
  constructor({ errorTypes }) {
    this.errorTypes = errorTypes
  }

  async createGame(requests, manager, guildId, member, options = {}) {
    const cooldown = manager.getCreateGameCooldown?.(guildId, member.id)
    if (cooldown) {
      return manager.createError(
        this.errorTypes.INVALID_STATE,
        `You cannot create a new game for another ${formatRemainingMinutes(cooldown.remainingMs)}.`
      )
    }

    if (manager.get(guildId)) {
      return manager.createError(this.errorTypes.ALREADY_IN_GAME, 'Game exists')
    }

    const script = manager.scripts.getDefaultScript()
    const game = {
      guildId,
      storytellerId: member.id,
      gameMode: normalizeGameMode(options.gameMode),
      state: 'lobby',
      phase: 'lobby',
      phaseStartedAt: Date.now(),
      phaseHistory: [],
      day: 1,
      scriptId: script.id,
      script: script.name,
      winner: null,
      winReason: null,
      pendingWin: null,
      pendingEndReveal: null,
      pendingManualImpReplacement: null,
      paused: null,
      replacementSlot: null,
      mastermindFinalDay: null,
      maxPlayers: 15,
      createdAt: Date.now(),
      startedAt: null,
      requests: [],
      messages: [],
      alivePlayers: [],
      deadPlayers: [],
      demonNotInPlayRoles: {},
      zombuulDeaths: {},
      nominations: [],
      nominationRequests: [],
      executionHistory: [],
      executedPlayer: null,
      executionCandidate: null,
      executionShields: {},
      nightActions: [],
      nightAreaSlots: {},
      nightOptions: {},
      pendingNightDeaths: [],
      nightChannels: {},
      nightCottageStatusMessages: {},
      nightInfoPromptMessages: {},
      nightInfoNoticeMessages: {},
      nightPromptMessages: {},
      nightVoiceChannels: {},
      pendingRoleInfoUpdates: {},
      roleInfoPromptMessages: {},
      roleInfoSent: {},
      playerGrimoires: {},
      storytellerDenChannelId: null,
      townsquareChannelId: null,
      privateConversationCreatorChannelId: null,
      playerMadeVoiceChannels: {},
      playerMadeVoiceAccess: {},
      publicDaySideChannelIds: {},
      votes: [],
      deadVotes: {},
      roles: {},
      shownRoles: {},
      lunaticInfo: {},
      roleHistory: {},
      roleCategories: manager.createDefaultRoleCategories(script.id),
      reminders: [],
      statusEffects: {},
      storytellerMoveRequests: {},
      substituteBriefings: {},
      users: {
        [member.id]: { role: 'storyteller' }
      }
    }

    const roleAdded = await manager.gameManager.addStorytellerRole(member)
    if (!roleAdded) {
      return manager.createError(this.errorTypes.TRANSACTION_FAILED, 'Could not assign Storyteller role')
    }

    manager.gameManager.games.set(guildId, game)

    await manager.gameManager.setNickname(member, 'storyteller')
    await manager.emit('GAME_CREATED', { game, member })
    manager.save()

    return createGameCreatedResult(manager, game, guildId)
  }

  async createTestGame(requests, manager, guildId, member, playerCount) {
    if (manager.get(guildId)) return manager.createError(this.errorTypes.ALREADY_IN_GAME, 'Game exists')

    const count = Number(playerCount)
    if (!Number.isInteger(count) || count < 1 || count > 15) {
      return manager.createError(this.errorTypes.INVALID_STATE, 'Test games need 1 to 15 fake players')
    }

    const script = manager.scripts.getDefaultScript()
    const fakeUsers = this.createFakePlayerUsers(count)
    const fakePlayerIds = Object.keys(fakeUsers)
    const game = {
      guildId,
      storytellerId: member.id,
      gameMode: GAME_MODE.discordOnly,
      testMode: true,
      state: 'lobby',
      phase: 'lobby',
      phaseStartedAt: Date.now(),
      phaseHistory: [],
      day: 1,
      scriptId: script.id,
      script: script.name,
      winner: null,
      winReason: null,
      pendingWin: null,
      pendingEndReveal: null,
      pendingManualImpReplacement: null,
      paused: null,
      replacementSlot: null,
      mastermindFinalDay: null,
      maxPlayers: count,
      createdAt: Date.now(),
      startedAt: null,
      requests: [],
      messages: [],
      alivePlayers: [...fakePlayerIds],
      deadPlayers: [],
      demonNotInPlayRoles: {},
      zombuulDeaths: {},
      nominations: [],
      nominationRequests: [],
      executionHistory: [],
      executedPlayer: null,
      executionCandidate: null,
      executionShields: {},
      nightActions: [],
      nightAreaSlots: {},
      nightOptions: {},
      pendingNightDeaths: [],
      nightChannels: {},
      nightCottageStatusMessages: {},
      nightInfoPromptMessages: {},
      nightInfoNoticeMessages: {},
      nightPromptMessages: {},
      nightVoiceChannels: {},
      pendingRoleInfoUpdates: {},
      roleInfoPromptMessages: {},
      roleInfoSent: {},
      playerGrimoires: {},
      storytellerDenChannelId: null,
      townsquareChannelId: null,
      privateConversationCreatorChannelId: null,
      playerMadeVoiceChannels: {},
      playerMadeVoiceAccess: {},
      publicDaySideChannelIds: {},
      votes: [],
      deadVotes: {},
      roles: {},
      shownRoles: {},
      lunaticInfo: {},
      roleHistory: {},
      roleCategories: manager.createDefaultRoleCategories(script.id),
      reminders: [],
      statusEffects: {},
      storytellerMoveRequests: {},
      substituteBriefings: {},
      users: {
        [member.id]: { role: 'storyteller' },
        ...fakeUsers
      }
    }

    const roleAdded = await manager.gameManager.addStorytellerRole(member)
    if (!roleAdded) {
      return manager.createError(this.errorTypes.TRANSACTION_FAILED, 'Could not assign Storyteller role')
    }

    manager.gameManager.games.set(guildId, game)
    await manager.gameManager.setNickname(member, 'storyteller')
    await manager.emit('GAME_CREATED', { game, member, testMode: true })
    manager.save()

    return createGameCreatedResult(manager, game, guildId)
  }

  createFakePlayerUsers(playerCount) {
    return Object.fromEntries(
      Array.from({ length: playerCount }, (_, index) => {
        const number = index + 1
        return [`test-player-${number}`, {
          role: 'player',
          fake: true,
          displayName: `Test Player ${number}`
        }]
      })
    )
  }

  async becomeStoryteller(requests, manager, guildId, member) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(this.errorTypes.NOT_FOUND, 'No game')

    if (game.storytellerId === member.id) return manager.createError(this.errorTypes.INVALID_STATE, 'Already storyteller')
    if (!manager.canStepInAsStoryteller(game, member.id)) {
      return manager.createError(this.errorTypes.PERMISSION_DENIED, 'Active players cannot become Storyteller')
    }
    if (game.storytellerId) return manager.createError(this.errorTypes.PERMISSION_DENIED, 'A Storyteller is already assigned')

    const roleAdded = await manager.gameManager.addStorytellerRole(member)
    if (!roleAdded) return manager.createError(this.errorTypes.TRANSACTION_FAILED, 'Could not assign Storyteller role')

    const spectatorRoleRemoved = await manager.gameManager.removeSpectatorRole(member)
    if (!spectatorRoleRemoved) return manager.createError(this.errorTypes.TRANSACTION_FAILED, 'Could not remove Spectator role')

    for (const [userId, user] of Object.entries(game.users || {})) {
      if (user.role === 'storyteller') delete game.users[userId]
    }

    game.storytellerId = member.id
    manager.setRole(game, member.id, 'storyteller')
    requests.removePendingRequestsForUser(game, member.id)

    await manager.gameManager.setNickname(member, 'storyteller')
    await manager.emit('STORYTELLER_CHANGED', { game, member })
    manager.save()

    return manager.createSuccess({ view: manager.serializeGame(game, { guildId }) })
  }
}

function createGameCreatedResult(manager, game, guildId) {
  return manager.createSuccess({
    refreshStorytellerDashboard: true,
    view: manager.serializeGame(game, { guildId })
  })
}

function normalizeGameMode(gameMode) {
  return isClocktowerLiveMode(gameMode) ? GAME_MODE.clocktowerLive : GAME_MODE.discordOnly
}

function formatRemainingMinutes(ms) {
  const minutes = Math.max(1, Math.ceil((Number(ms) || 0) / 60000))
  return `${minutes} minute${minutes === 1 ? '' : 's'}`
}

module.exports = GameCreationService
