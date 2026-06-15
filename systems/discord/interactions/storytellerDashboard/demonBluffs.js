function recordDemonNotInPlayRoles({ context, entry, gameLifecycle, roleIds }) {
  const playerId = entry?.playerId
  if (!playerId || !isDemonRole(context?.view, entry?.action?.roleId)) return false

  const game = context?.game || gameLifecycle.get?.(context?.view?.guildId)
  if (!game) return false

  game.demonNotInPlayRoles ??= {}
  game.demonNotInPlayRoles[playerId] = roleIds.slice(0, 3)
  gameLifecycle.save?.()
  return true
}

function isDemonRole(view, roleId) {
  return (view?.engine?.roleCategories?.demon || []).includes(roleId)
}

module.exports = {
  isDemonRole,
  recordDemonNotInPlayRoles
}
