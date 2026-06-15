function assertNoOpenVote(manager, game, excludeId = null) {
  const active = (game.nominations || []).find(nomination =>
    nomination.id !== excludeId &&
    nomination.day === (game.day || 1) &&
    nomination.status === 'voting'
  )

  if (!active) return manager.createSuccess()

  return manager.createError(
    manager.errorTypes.INVALID_STATE,
    'There is already an open vote'
  )
}

function assertNominationLive(manager, game, nomination, statuses, phases, message) {
  if (nomination.day !== (game.day || 1)) {
    return manager.createError(
      manager.errorTypes.INVALID_STATE,
      'That nomination belongs to an earlier day'
    )
  }

  if (!statuses.includes(nomination.status)) {
    return manager.createError(manager.errorTypes.INVALID_STATE, message)
  }

  if (!phases.includes(game.phase)) {
    return manager.createError(manager.errorTypes.INVALID_STATE, message)
  }

  return manager.createSuccess()
}

module.exports = {
  assertNoOpenVote,
  assertNominationLive
}
