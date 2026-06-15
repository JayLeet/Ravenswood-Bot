function isAlive(game, playerId) {
  return (game.alivePlayers || []).includes(playerId)
}

function canDeadActorUseNightAction(game, action, actorId) {
  if (isAlive(game, actorId)) return true
  return action.allowDeadActor === true
}

function canUseHookWhileDead(game, playerId, hookName) {
  if (isAlive(game, playerId)) return true
  return hookName === 'onDeath' || hookName === 'onExecution' || hookName === 'onPhaseStart'
}

async function recordDeadAbilityBlocked(manager, game, action, role) {
  const result = {
    blocked: true,
    summary: 'Dead players have no character ability.'
  }
  action.result = result
  await manager.emit('ROLE_NIGHT_ACTION_RESOLVED', { game, action, role, result })
  return result
}

module.exports = {
  canDeadActorUseNightAction,
  canUseHookWhileDead,
  isAlive,
  recordDeadAbilityBlocked
}
