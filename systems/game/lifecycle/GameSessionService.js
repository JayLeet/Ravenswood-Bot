const phases = require('../phases')
const {
  isClocktowerLiveMode
} = require('../../../utils/gameModes')
const {
  createBotLogger
} = require('../../../utils/logger')
const {
  cleanupPlayerMadeVoiceChannelRef,
  clearPlayerMadeVoiceState
} = require('../../discord/interactions/voiceChannels/dayPrivateConversationCleanup')
const {
  createDawnDeathNotices
} = require('../night/NightDeathAnnouncements')
const {
  cleanupEndedGameVoiceAndRoles
} = require('../cleanup/PostGameVoiceCleanup')
const {
  getNextPhaseForGame,
  setClocktowerLivePhase
} = require('./GameSessionClocktowerLivePhase')
const endReveal = require('./GameSessionEndReveal')
const gameStart = require('./GameSessionStart')
const log = createBotLogger({ subsystem: 'GameSessionService' })

class GameSessionService {
  constructor({ errorTypes, random = Math.random }) {
    this.errorTypes = errorTypes
    this.random = random
  }

  evaluateWinConditions(manager, game, options = {}) {
    if (game.state !== 'in-game') return null
    if (isClocktowerLiveMode(game)) return null
    if (manager?.winConditions) return manager.winConditions.evaluate(manager, game, options)
    return game.pendingWin || null
  }

  async forceEnd(manager, game, win, guild = null) {
    if (guild && manager.gameManager?.removeGameRolesFromUsers) {
      const rolesRemoved = await manager.gameManager.removeGameRolesFromUsers(guild, game.users)
      if (!rolesRemoved) {
        return manager.createError(
          this.errorTypes.TRANSACTION_FAILED,
          'Could not remove one or more game roles'
        )
      }
      await cleanupEndedGameVoiceAndRoles(guild, manager.gameManager).catch(err => {
        log.recoverable('cleanup-ended-game-voice-and-roles', err, { guildId: game.guildId })
      })
    }

    game.state = 'ended'
    game.phase = null
    game.winner = win.winner
    game.winReason = win.reason
    game.endedAt = Date.now()

    const pendingSummary = manager.sessionHistory?.save?.(game, win) || null

    await manager.emit('GAME_ENDED', { game, winner: win.winner, reason: win.reason })
    await manager.cleanupNightChannelMessages?.(guild, game)
    await manager.cleanupNightChannels?.(guild, game)
    await manager.cleanupNightVoiceChannels?.(guild, game)
    await cleanupTemporaryPlayerMadeVoiceChannels(manager, guild, game)
    await manager.cleanupTrackedMessages?.(guild, game)

    clearEndedGameState(manager, game)
    manager.save()

    return manager.createSuccess({
      ended: true,
      cleanupSetupChannels: true,
      winner: win.winner,
      pendingSummary,
      reason: win.reason,
      publicMessage:
        `The game has ended.\n` +
        `Winner: ${win.winner}\n` +
        `Reason: ${win.reason}`
    })
  }

  async setPhase(manager, game, nextPhase, guild = null, options = {}) {
    const finalExecution = await this.finalizeExecutionBeforeNight(manager, game, nextPhase, options.member)
    if (!finalExecution.ok) return finalExecution

    const win = this.evaluateWinConditions(manager, game, { finalExecution, nextPhase })
    if (win) return this.forceEnd(manager, game, win, guild)

    const result = phases.transitionGame(game, nextPhase, { reason: options.reason || 'phase-advance' })
    if (!result.ok) {
      return manager.createError(this.errorTypes.INVALID_STATE, result.error, {
        from: result.from,
        to: result.to
      })
    }

    const { transition } = result
    await manager.emit('PHASE_CHANGED', { game, from: transition.from, to: transition.to, transition })

    if (transition.to === 'night' && guild) await manager.cleanupTrackedMessages?.(guild, game)

    await manager.roleEngine.handlePhaseStart(manager, game, transition, {
      createdBy: game.storytellerId,
      reason: 'phase-transition'
    })

    const phaseWin = this.evaluateWinConditions(manager, game)
    if (phaseWin) return this.forceEnd(manager, game, phaseWin, guild)

    manager.save()

    return manager.createSuccess({
      phase: game.phase,
      phaseLabel: formatPhase(manager, game),
      day: game.day,
      executionResult: finalExecution.executionResult || null,
      publicEmbeds: createPhasePublicEmbeds(manager, game, transition),
      publicMessage: finalExecution.publicMessage || null
    })
  }

  async finalizeExecutionBeforeNight(manager, game, nextPhase, member = null) {
    if (phases.normalizePhaseId(game.phase) !== 'nominations' || nextPhase !== 'night') {
      return manager.createSuccess()
    }

    const result = await manager.finalizeExecutionCandidate(game, member)
    if (!result.ok) return result
    return manager.createSuccess({ executionResult: result, publicMessage: result.publicMessage })
  }

  async nextPhase(manager, game, guild = null, options = {}) {
    const next = getNextPhaseForGame(game)
    if (!next) return manager.createError(this.errorTypes.INVALID_STATE, 'No next phase')
    if (isClocktowerLiveMode(game)) return setClocktowerLivePhase(this, manager, game, next, guild, options)
    return this.setPhase(manager, game, next, guild, options)
  }

  async advancePhase(manager, guildId, member) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(this.errorTypes.NOT_FOUND, 'No game')
    if (!manager.isStoryteller(game, member.id)) {
      return manager.createError(this.errorTypes.PERMISSION_DENIED, 'Not storyteller')
    }
    if (game.state !== 'in-game') return manager.createError(this.errorTypes.INVALID_STATE, 'Game is not in progress')
    if (game.paused) {
      return manager.createError(
        this.errorTypes.INVALID_STATE,
        'The game is paused while a replacement player is needed. Use Requests to approve a substitute or force resume.'
      )
    }

    return manager.runSingleFlight?.(`advance-phase:${guildId}`, () => this.nextPhase(manager, game, member.guild, { member })) ||
      this.nextPhase(manager, game, member.guild, { member })
  }

  async startGame(manager, guildId, member) {
    return gameStart.startGame(this, manager, guildId, member)
  }

  async endGame(manager, guildId, member) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(this.errorTypes.NOT_FOUND, 'No game')
    if (!manager.isStoryteller(game, member.id)) {
      return manager.createError(this.errorTypes.PERMISSION_DENIED, 'Not storyteller')
    }

    return this.forceEnd(manager, game, {
      winner: 'none',
      reason: `Ended by <@${member.id}>`
    }, member.guild)
  }

  async resumeGame(manager, guildId, member) {
    return this.forceResumeAfterKick(manager, guildId, member)
  }

  async forceResumeAfterKick(manager, guildId, member) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(this.errorTypes.NOT_FOUND, 'No game')
    if (!manager.isStoryteller(game, member.id)) {
      return manager.createError(this.errorTypes.PERMISSION_DENIED, 'Not storyteller')
    }
    if (!game.paused) return manager.createError(this.errorTypes.INVALID_STATE, 'Game is not paused')

    const paused = game.paused
    game.paused = null
    game.resumedAt = Date.now()
    await manager.emit('GAME_RESUMED', { game, member, paused })
    manager.save()

    return manager.createSuccess({
      view: manager.serializeGame(game, { guildId }),
      publicMessage: 'The Storyteller resumed the game without waiting for a replacement.',
      storytellerMessage: 'The game was forcefully resumed. The replacement slot is still available if you approve a join request later.'
    })
  }

  openEndReveal(manager, guildId, member) {
    return endReveal.openEndReveal(this, manager, guildId, member)
  }

  revealGrimPlayer(manager, guildId, member, playerId, revealId) {
    return endReveal.revealGrimPlayer(this, manager, guildId, member, playerId, revealId)
  }

  cancelEndReveal(manager, guildId, member, revealId) {
    return endReveal.cancelEndReveal(this, manager, guildId, member, revealId)
  }

  async endGameWithWinner(manager, guildId, member, winner, revealId = null) {
    return endReveal.endGameWithWinner(this, manager, guildId, member, winner, revealId)
  }

  validateEndReveal(manager, game, member, revealId) {
    return endReveal.validateEndReveal(this, manager, game, member, revealId)
  }

  serializeView(manager, game, guildId) {
    return endReveal.serializeView(manager, game, guildId)
  }
}

function createPhasePublicEmbeds(manager, game, transition) {
  return createDawnDeathNotices(manager, game, transition)
}

function clearEndedGameState(manager, game) {
  game.users = {}
  game.requests = []
  game.messages = []
  game.nightChannels = {}
  game.nightVoiceChannels = {}
  game.demonNotInPlayRoles = {}
  game.lunaticInfo = {}
  game.zombuulDeaths = {}
  game.mastermindFinalDay = null
  game.nightCottageStatusMessages = {}
  game.nightInfoPromptMessages = {}
  game.nightInfoNoticeMessages = {}
  game.nightPromptMessages = {}
  game.pendingRoleInfoUpdates = {}
  game.playerMadeVoiceChannels = {}
  game.playerMadeVoiceAccess = {}
  game.publicDaySideChannelIds = {}
  game.executionCandidate = null
  game.roleInfoPromptMessages = {}
  game.roleInfoSent = {}
  game.playerGrimoires = {}
  game.storytellerDenChannelId = null
  game.townsquareChannelId = null
  game.privateConversationCreatorChannelId = null
  if (game.guildId) manager.gameManager?.games?.delete?.(game.guildId)
}

async function cleanupTemporaryPlayerMadeVoiceChannels(manager, guild, game) {
  if (!guild || !game?.playerMadeVoiceChannels) return 0

  let touched = 0
  for (const [playerId, channelId] of Object.entries(game.playerMadeVoiceChannels || {})) {
    const cleaned = await cleanupPlayerMadeVoiceChannelRef({
      actionPrefix: 'temporary-player-made-voice-channel',
      channelId,
      deleteReason: 'BOTC cleanup temporary player-made day voice channel',
      guild,
      logger: log,
      playerId
    })
    if (!cleaned) continue

    clearPlayerMadeVoiceState({ game, gameLifecycle: manager, guildId: guild.id, playerId })
    touched += 1
  }
  return touched
}

function formatPhase(manager, game) {
  return typeof manager.formatPhase === 'function' ? manager.formatPhase(game) : game.phase
}

module.exports = GameSessionService
