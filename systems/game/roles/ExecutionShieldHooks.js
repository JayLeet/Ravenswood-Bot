const ability = require('./RoleAbilityEligibility')

async function findExecutionShield(engine, manager, game, targetId, context = {}) {
  for (const { playerId, role, behavior } of getExecutionShieldHookCandidates(engine, manager, game, targetId)) {
    const hook = behavior?.executionShield
    if (typeof hook !== 'function') continue
    const result = await hook(engine.createRoleContext(manager, game, role, {
      ...context,
      playerId,
      shieldedPlayerId: targetId,
      targetId
    }))
    const shield = normalizeExecutionShield(result, targetId, playerId, role)
    if (!shield) continue
    await manager.emit('ROLE_HOOK_RESOLVED', { game, playerId, role, hook: 'executionShield', result: shield })
    return shield
  }
  return null
}

function getExecutionShieldHookCandidates(engine, manager, game, targetId) {
  const playerIds = [
    targetId,
    ...manager.getPlayerIds(game).filter(playerId => playerId !== targetId)
  ].filter(Boolean)

  return playerIds
    .filter(playerId => ability.canUseHookWhileDead(game, playerId, 'executionShield'))
    .map(playerId => {
      const role = engine.getRole(manager, game, playerId)
      return { playerId, role, behavior: engine.getBehavior(manager, game, role) }
    })
}

function normalizeExecutionShield(result, targetId, sourcePlayerId, role) {
  if (!result) return null
  const base = result === true ? {} : result
  if (!base || typeof base !== 'object') return null

  const shield = {
    ...base,
    playerId: base.playerId || targetId,
    roleId: base.roleId || role?.id || null,
    type: base.type || role?.id || 'role'
  }

  if (sourcePlayerId && sourcePlayerId !== targetId) {
    shield.sourcePlayerId ??= sourcePlayerId
  }

  return shield
}

module.exports = {
  findExecutionShield
}
