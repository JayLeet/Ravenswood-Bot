function createGameLifecycleRuntimeState(manager) {
  const games = getGames(manager)
  const state = {
    createGameCooldowns: manager?.createGameCooldowns?.size || 0,
    games: {
      byPhase: {},
      byState: {},
      total: games.length
    },
    nightActions: {
      awaiting: 0,
      cancelled: 0,
      resolved: 0,
      submitted: 0,
      total: 0,
      unresolved: 0
    },
    pendingState: {
      endReveals: 0,
      manualImpReplacements: 0,
      nightCottageStatusMessages: 0,
      nightInfoPromptMessages: 0,
      nightDeaths: 0,
      nightInfoNoticeMessages: 0,
      nightPromptMessages: 0,
      pausedGames: 0,
      pendingRoleInfoUpdates: 0,
      pendingWins: 0,
      replacementSlots: 0,
      roleInfoPromptMessages: 0,
      storytellerMoveRequests: 0,
      trackedMessages: 0
    },
    requests: {
      grimoire: 0,
      join: 0,
      nominationPending: 0,
      pending: 0,
      spectate: 0
    }
  }

  for (const game of games) {
    increment(state.games.byState, game?.state || 'unknown')
    increment(state.games.byPhase, game?.phase || 'none')
    addRequests(state.requests, game, manager)
    addNightActions(state.nightActions, game, manager)
    addPendingState(state.pendingState, game)
  }

  if (typeof manager?.events?.getRuntimeState === 'function') {
    state.events = manager.events.getRuntimeState()
  }

  return state
}

function getGames(manager) {
  const values = manager?.gameManager?.games?.values
  return typeof values === 'function' ? [...values.call(manager.gameManager.games)] : []
}

function addRequests(target, game, manager) {
  const pendingRequests = (game?.requests || []).filter(request => request.status === 'pending')
  target.pending += pendingRequests.length
  for (const request of pendingRequests) {
    if (Object.prototype.hasOwnProperty.call(target, request.type)) target[request.type] += 1
  }

  const nominationRequests = manager?.voting?.getPendingNominationRequests?.(game) || []
  target.nominationPending += nominationRequests.length
}

function addNightActions(target, game, manager) {
  const actions = game?.nightActions || []
  const counts = manager?.nightActions?.countByStatus?.(game) || countNightActions(actions)
  target.total += actions.length
  target.awaiting += counts.awaiting || 0
  target.submitted += counts.submitted || 0
  target.resolved += counts.resolved || 0
  target.cancelled += counts.cancelled || 0
  target.unresolved += counts.unresolved || 0
}

function countNightActions(actions) {
  const counts = { awaiting: 0, submitted: 0, resolved: 0, cancelled: 0, unresolved: 0 }
  for (const action of actions) {
    if (action.status === 'awaiting_target') counts.awaiting += 1
    if (action.status === 'submitted') counts.submitted += 1
    if (action.status === 'resolved') counts.resolved += 1
    if (action.status === 'cancelled') counts.cancelled += 1
  }
  counts.unresolved = counts.awaiting + counts.submitted
  return counts
}

function addPendingState(target, game) {
  if (game?.pendingEndReveal) target.endReveals += 1
  if (game?.pendingManualImpReplacement) target.manualImpReplacements += 1
  target.nightDeaths += (game?.pendingNightDeaths || []).length
  if (game?.paused) target.pausedGames += 1
  if (game?.pendingWin) target.pendingWins += 1
  if (game?.replacementSlot) target.replacementSlots += 1
  target.nightCottageStatusMessages += countKeys(game?.nightCottageStatusMessages)
  target.nightInfoPromptMessages += countNestedKeys(game?.nightInfoPromptMessages)
  target.nightInfoNoticeMessages += countKeys(game?.nightInfoNoticeMessages)
  target.nightPromptMessages += countKeys(game?.nightPromptMessages)
  target.pendingRoleInfoUpdates += countKeys(game?.pendingRoleInfoUpdates)
  target.roleInfoPromptMessages += countKeys(game?.roleInfoPromptMessages)
  target.storytellerMoveRequests += countKeys(game?.storytellerMoveRequests)
  target.trackedMessages += (game?.messages || []).length
}

function countKeys(value) {
  return value && typeof value === 'object' ? Object.keys(value).length : 0
}

function countNestedKeys(value) {
  if (!value || typeof value !== 'object') return 0
  return Object.values(value).reduce((total, refs) => total + countKeys(refs), 0)
}

function increment(target, key) {
  target[key] = (target[key] || 0) + 1
}

module.exports = {
  createGameLifecycleRuntimeState
}
