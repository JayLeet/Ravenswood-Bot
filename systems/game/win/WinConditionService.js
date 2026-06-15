const GOOD_WIN = 'good'
const EVIL_WIN = 'evil'
const ZOMBUUL_ROLE_ID = 'zombuul'
const MASTER_MIND_ROLE_ID = 'mastermind'
const VORTOX_ROLE_ID = 'vortox'

class WinConditionService {
  evaluate(manager, game, options = {}) {
    if (game?.state !== 'in-game') return null

    if (game.pendingWin) return normalizeWin(game.pendingWin)

    const alivePlayers = game.alivePlayers || []
    if (alivePlayers.length === 0) {
      return normalizeWin({
        winner: 'no-one',
        reason: 'No living players remain'
      })
    }

    const mastermindWin = this.evaluateMastermind(manager, game, options)
    if (mastermindWin) return mastermindWin

    const hasLivingDemon = this.hasLivingDemon(manager, game)
    if (!hasLivingDemon && game.mastermindFinalDay?.active) return null

    if (!hasLivingDemon) {
      return normalizeWin({
        winner: GOOD_WIN,
        reason: 'No living Demon remains'
      })
    }

    if (alivePlayers.length === 2 && alivePlayers.some(playerId => this.isDemon(manager, game, playerId))) {
      return normalizeWin({
        winner: EVIL_WIN,
        reason: 'Only two players live, and one of them is the Demon'
      })
    }

    if (this.shouldVortoxWin(manager, game, options)) {
      return normalizeWin({
        winner: EVIL_WIN,
        reason: 'The Vortox lived through a day with no execution'
      })
    }

    return null
  }

  getRevealLock(manager, game) {
    const win = this.evaluate(manager, game, { preview: true })
    if (win) return win
    if (game.mastermindFinalDay?.active && !this.hasLivingDemon(manager, game)) {
      return normalizeWin({
        winner: EVIL_WIN,
        reason: 'The Mastermind final day is active'
      })
    }
    return null
  }

  evaluateMastermind(manager, game, options = {}) {
    const state = game.mastermindFinalDay
    if (state?.active && this.isDayEnding(options) && Number(game.day || 1) > Number(state.demonDiedDay || 0)) {
      return normalizeWin({
        winner: EVIL_WIN,
        reason: 'The Mastermind made good lose after the Demon died by execution'
      })
    }

    if (this.hasLivingDemon(manager, game)) return null
    if (!this.hasActiveLivingRole(manager, game, MASTER_MIND_ROLE_ID)) return null
    if (!this.wasDemonExecutedToday(manager, game)) return null

    if (!options.preview) {
      game.mastermindFinalDay = {
        active: true,
        demonDiedDay: game.day || 1,
        startedAt: Date.now()
      }
    }

    return null
  }

  shouldVortoxWin(manager, game, options = {}) {
    if (!this.isDayEnding(options)) return false
    if (!this.hasActiveLivingRole(manager, game, VORTOX_ROLE_ID)) return false
    return !game.executedPlayer
  }

  isDayEnding(options = {}) {
    return options.nextPhase === 'night' || options.finalizingDay === true
  }

  hasLivingDemon(manager, game) {
    return this.getPlayerIds(manager, game).some(playerId =>
      this.isDemon(manager, game, playerId) &&
      this.isAliveForDemonWinCheck(game, playerId)
    )
  }

  isAliveForDemonWinCheck(game, playerId) {
    if ((game.alivePlayers || []).includes(playerId)) return true
    return game.roles?.[playerId] === ZOMBUUL_ROLE_ID &&
      game.zombuulDeaths?.[playerId] === 1
  }

  isDemon(manager, game, playerId) {
    const roleId = game.roles?.[playerId]
    return manager.scripts.getRole(game.scriptId, roleId)?.team === 'demon'
  }

  hasActiveLivingRole(manager, game, roleId) {
    return (game.alivePlayers || []).some(playerId =>
      game.roles?.[playerId] === roleId &&
      !isDrunkOrPoisoned(game, playerId)
    )
  }

  wasDemonExecutedToday(manager, game) {
    const latest = [...(game.executionHistory || [])]
      .reverse()
      .find(record => record.day === (game.day || 1) && record.executed === true)
    if (!latest?.playerId) return false
    return this.isDemon(manager, game, latest.playerId)
  }

  getPlayerIds(manager, game) {
    if (typeof manager.getPlayerIds === 'function') return manager.getPlayerIds(game)
    return Object.keys(game.users || {}).filter(userId => game.users[userId]?.role === 'player')
  }
}

function normalizeWin(win) {
  return {
    ...win,
    forcedWinner: win.forcedWinner || win.winner,
    disabledWinner: win.disabledWinner || getOpposingWinner(win.winner)
  }
}

function getOpposingWinner(winner) {
  if (winner === GOOD_WIN) return EVIL_WIN
  if (winner === EVIL_WIN) return GOOD_WIN
  return null
}

function isDrunkOrPoisoned(game, playerId) {
  const effects = game.statusEffects?.[playerId] || {}
  return effects.drunk === true || effects.poisoned === true
}

module.exports = WinConditionService
