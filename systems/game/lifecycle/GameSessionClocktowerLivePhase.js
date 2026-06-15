const phases = require('../phases')
const {
  isClocktowerLiveMode
} = require('../../../utils/gameModes')
const {
  createDawnDeathNotices
} = require('../night/NightDeathAnnouncements')

function getNextPhaseForGame(game) {
  if (!isClocktowerLiveMode(game)) return phases.getNextPhase(game.phase)
  const phase = phases.normalizePhase(game)
  if (phase === 'night') return 'day'
  if (phase === 'day') return 'night'
  return phases.getNextPhase(game.phase)
}

async function setClocktowerLivePhase(service, manager, game, nextPhase, guild = null, options = {}) {
  const from = phases.normalizePhase(game)
  const transition = {
    from,
    to: nextPhase,
    advancesDay: from === 'day' && nextPhase === 'night',
    resetsDayState: from === 'night' && nextPhase === 'day'
  }
  phases.recoverPhase(game, nextPhase, { reason: options.reason || 'clocktower-live-phase-toggle' })
  if (transition.advancesDay) game.day = (game.day || 1) + 1

  await manager.emit('PHASE_CHANGED', { game, from, to: nextPhase, transition })

  if (nextPhase === 'night' && guild && typeof manager.cleanupTrackedMessages === 'function') {
    await manager.cleanupTrackedMessages(guild, game)
  }

  manager.save()

  return manager.createSuccess({
    phase: game.phase,
    phaseLabel: manager.formatPhase(game),
    day: game.day,
    executionResult: null,
    publicEmbeds: createDawnDeathNotices(manager, game, transition),
    publicMessage: null
  })
}

module.exports = {
  getNextPhaseForGame,
  setClocktowerLivePhase
}
