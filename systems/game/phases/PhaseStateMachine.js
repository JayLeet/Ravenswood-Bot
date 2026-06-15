const {
  PHASE_LABELS,
  PHASE_STATES,
  normalizePhaseId
} = require('./definitions')

function normalizePhase(game) {
  if (game.phase && PHASE_STATES[game.phase]) return game.phase
  return game.state === 'in-game' ? 'night' : 'lobby'
}

function formatPhase(game) {
  const label = formatPublicPhaseName(game.phase)
  if (game.state !== 'in-game' || !game.day) return label
  if (isDaySubstate(game.phase)) return `Day ${game.day} - ${label}`
  return `${label} ${game.day}`
}

function formatPublicPhaseName(phase) {
  if (phase === 'day') return 'Discussion'
  if (phase === 'nominations') return 'Nominations'
  return PHASE_LABELS[phase] || phase || 'None'
}

function isDaySubstate(phase) {
  return ['day', 'nominations'].includes(phase)
}

function getNextPhase(phase) {
  return getAllowedTransitions(phase)[0] || null
}

function getAllowedTransitions(phase) {
  const normalized = normalizePhaseId(phase)
  return PHASE_STATES[normalized]?.allowedNext || []
}

function canTransition(fromPhase, toPhase) {
  const to = normalizePhaseId(toPhase)
  if (!to || !PHASE_STATES[to]) return false

  const from = normalizePhaseId(fromPhase)
  return getAllowedTransitions(from).includes(to)
}

function createTransition(game, toPhase) {
  const from = normalizePhase(game)
  const to = normalizePhaseId(toPhase)

  if (!PHASE_STATES[to]) {
    return { ok: false, error: `Unknown phase: ${to}`, from, to }
  }

  if (!canTransition(from, to)) {
    return { ok: false, error: `Invalid phase transition: ${from || 'none'} -> ${to}`, from, to }
  }

  return createTransitionSuccess(from, to)
}

function transitionGame(game, toPhase, options = {}) {
  const result = createTransition(game, toPhase)
  if (!result.ok) return result

  applyTransition(game, result.transition, options)
  return result
}

function recoverPhase(game, toPhase, options = {}) {
  const from = normalizePhaseId(game.phase)
  const to = normalizePhaseId(toPhase)

  if (!PHASE_STATES[to]) {
    return { ok: false, error: `Unknown phase: ${to}`, from, to }
  }

  const result = createTransitionSuccess(from, to)
  applyTransition(game, {
    ...result.transition,
    advancesDay: false,
    resetsDayState: false
  }, options)

  return result
}

function applyTransition(game, transition, options = {}) {
  const now = options.now || Date.now()

  if (transition.advancesDay) {
    game.day = (game.day || 1) + 1
  }

  if (transition.resetsDayState) {
    game.nominations = []
    game.votes = []
    game.executedPlayer = null
    game.executionCandidate = null
  }

  game.phase = transition.to
  game.phaseStartedAt = now
  game.phaseHistory = normalizePhaseHistory(game.phaseHistory)
  game.phaseHistory.push({
    from: transition.from,
    to: transition.to,
    day: game.day || 1,
    reason: options.reason || null,
    createdAt: now
  })

  if (game.phaseHistory.length > 50) {
    game.phaseHistory = game.phaseHistory.slice(-50)
  }
}

function normalizePhaseHistory(history) {
  return Array.isArray(history) ? history : []
}

function createTransitionSuccess(from, to) {
  return {
    ok: true,
    transition: {
      from,
      to,
      advancesDay: shouldAdvanceDay(from, to),
      resetsDayState: shouldResetDayState(from, to)
    }
  }
}

function shouldAdvanceDay(fromPhase, toPhase) {
  return normalizePhaseId(fromPhase) === 'nominations' && toPhase === 'night'
}

function shouldResetDayState(fromPhase, toPhase) {
  return fromPhase === 'night' && toPhase === 'day'
}

module.exports = {
  canTransition,
  createTransition,
  formatPhase,
  formatPublicPhaseName,
  getAllowedTransitions,
  getNextPhase,
  normalizePhase,
  normalizePhaseHistory,
  recoverPhase,
  shouldAdvanceDay,
  shouldResetDayState,
  transitionGame
}
