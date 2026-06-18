/** @type {import('../../../types').PhaseLabelMap} */
const PHASE_LABELS = {
  lobby: 'Lobby',
  night: 'Night',
  day: 'Day',
  nominations: 'Nominations'
}

/** @type {import('../../../types').PhaseStateMap} */
const PHASE_STATES = {
  lobby: {
    id: 'lobby',
    label: PHASE_LABELS.lobby,
    allowedNext: ['night'],
    terminal: false
  },
  night: {
    id: 'night',
    label: PHASE_LABELS.night,
    allowedNext: ['day'],
    terminal: false
  },
  day: {
    id: 'day',
    label: PHASE_LABELS.day,
    allowedNext: ['nominations'],
    terminal: false
  },
  nominations: {
    id: 'nominations',
    label: PHASE_LABELS.nominations,
    allowedNext: ['night'],
    terminal: false
  }
}

/** @type {import('../../../types').PhaseFlow} */
const PHASE_FLOW = Object.freeze(
  Object.fromEntries(
    Object.entries(PHASE_STATES)
      .filter(([, state]) => state.allowedNext.length === 1 && state.id !== 'lobby')
      .map(([phase, state]) => [phase, state.allowedNext[0]])
  )
)

function normalizePhaseId(phase) {
  return phase || null
}

function isKnownPhase(phase) {
  return !!PHASE_STATES[normalizePhaseId(phase)]
}

function validatePhaseDefinitions() {
  const issues = []
  for (const [phase, state] of Object.entries(PHASE_STATES)) {
    if (state.id !== phase) issues.push(`Phase ${phase} has mismatched id ${state.id}`)
    if (!PHASE_LABELS[phase]) issues.push(`Phase ${phase} is missing a public label`)
    if (!Array.isArray(state.allowedNext)) issues.push(`Phase ${phase} allowedNext is not an array`)

    for (const next of state.allowedNext || []) {
      if (!PHASE_STATES[next]) issues.push(`Phase ${phase} allows unknown next phase ${next}`)
    }
  }

  for (const [phase, next] of Object.entries(PHASE_FLOW)) {
    const firstAllowed = PHASE_STATES[phase]?.allowedNext?.[0] || null
    if (next !== firstAllowed) issues.push(`Phase flow ${phase} points to ${next} instead of ${firstAllowed}`)
  }

  return issues
}

module.exports = {
  PHASE_FLOW,
  PHASE_LABELS,
  PHASE_STATES,
  isKnownPhase,
  normalizePhaseId,
  validatePhaseDefinitions
}
