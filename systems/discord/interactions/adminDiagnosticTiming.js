const DEFAULT_SLOW_INTERACTION_NOTICE_MS = 3000
const DEFAULT_INTERACTION_ACK_MS = 2000
const FINISHED_DIAGNOSTIC_DELETE_DELAY_MS = 10000
const MIN_RUNNING_DIAGNOSTIC_DISPLAY_MS = 3000
const RUNNING_DIAGNOSTIC_PROGRESS_INTERVAL_MS = 500
const DELAYED_INTERACTION_NOTICE_MS = 30000
const STUCK_INTERACTION_NOTICE_MS = 60000

function getInteractionAckDelayMs(slowInteractionNoticeMs) {
  const slowMs = Number(slowInteractionNoticeMs)
  if (!Number.isFinite(slowMs) || slowMs <= 0) return 0
  return Math.max(0, Math.min(DEFAULT_INTERACTION_ACK_MS, slowMs - 250))
}

function getRunningNoticeLevel(elapsedMs) {
  if (elapsedMs >= STUCK_INTERACTION_NOTICE_MS) return 'stuck'
  if (elapsedMs >= DELAYED_INTERACTION_NOTICE_MS) return 'delayed'
  return 'normal'
}

function getRunningTitle(level) {
  if (level === 'stuck') return 'Action needs attention'
  if (level === 'delayed') return 'Action delayed'
  return 'Action still running'
}

function createRunningDescription(context, level) {
  if (level === 'stuck') {
    return 'This action has taken longer than 60 seconds. I am not retrying it automatically because that could duplicate game changes; check whether the game state changed, then use the error details or bot logs if it stays stuck.'
  }
  if (level === 'delayed') {
    return 'This action is taking longer than expected. The bot is still waiting on the step shown below.'
  }
  return 'This action is still running. The bot has acknowledged it and will keep working in the background.'
}

function getRunningReason(context) {
  const action = String(context?.action || '').toLowerCase()
  if (action === '/admin end-game') return 'Force-ending the game, removing game roles/nicknames, and starting end-game channel cleanup.'
  if (action === '/end-game') return 'Ending the game, removing game roles/nicknames, and starting end-game channel cleanup.'
  if (action.includes('night-order')) return 'Refreshing Night Order Guidance, player labels, and any current wake/prompt state.'
  if (action.includes('random-roles')) return 'Applying the random role draft and refreshing Storyteller dashboard state.'
  if (action.includes('create-game:test')) return 'Creating the test lobby, fake players, seating order, panels, and dashboard state.'
  if (action.includes('create-game')) return 'Creating the lobby, setup-managed game state, panels, and dashboard state.'
  if (action.includes('advance')) return 'Advancing game phase and updating public/private game surfaces.'
  return 'Waiting on Discord or game-state work for this interaction.'
}

module.exports = {
  DEFAULT_SLOW_INTERACTION_NOTICE_MS,
  DEFAULT_INTERACTION_ACK_MS,
  FINISHED_DIAGNOSTIC_DELETE_DELAY_MS,
  MIN_RUNNING_DIAGNOSTIC_DISPLAY_MS,
  RUNNING_DIAGNOSTIC_PROGRESS_INTERVAL_MS,
  createRunningDescription,
  getInteractionAckDelayMs,
  getRunningNoticeLevel,
  getRunningReason,
  getRunningTitle
}
