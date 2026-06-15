function getAssignedRole(manager, game, playerId) {
  const roleId = game.roles?.[playerId]
  return roleId ? manager.scripts.getRole(game.scriptId, roleId) : null
}

function getRoleName(manager, game, playerId) {
  return getAssignedRole(manager, game, playerId)?.name || 'Unknown role'
}

function isTeam(manager, game, playerId, teams) {
  const role = getAssignedRole(manager, game, playerId)
  return role ? teams.includes(role.team) : false
}

function isEvil(manager, game, playerId) {
  return isTeam(manager, game, playerId, ['minion', 'demon'])
}

function getTableOrder(manager, game, livingOnly = false) {
  const players = manager.getPlayerIds(game)
  if (!livingOnly) return players
  return players.filter(playerId => (game.alivePlayers || []).includes(playerId))
}

function countEvilPairs(manager, game) {
  const order = getTableOrder(manager, game)
  if (order.length < 2) return 0

  let pairs = 0
  for (let index = 0; index < order.length; index += 1) {
    const left = order[index]
    const right = order[(index + 1) % order.length]
    if (isEvil(manager, game, left) && isEvil(manager, game, right)) pairs += 1
  }
  return pairs
}

function getLivingNeighbors(manager, game, playerId) {
  const order = getTableOrder(manager, game, true)
  const index = order.indexOf(playerId)
  if (index === -1 || order.length < 2) return []

  if (order.length === 2) return [order[index === 0 ? 1 : 0]]

  return [
    order[(index - 1 + order.length) % order.length],
    order[(index + 1) % order.length]
  ]
}

function countEvilLivingNeighbors(manager, game, playerId) {
  return getLivingNeighbors(manager, game, playerId)
    .filter(neighborId => isEvil(manager, game, neighborId))
    .length
}

function getTargetIds(action, targetId) {
  const ids = action?.targetIds?.length ? action.targetIds : [targetId]
  return [...new Set(ids.filter(Boolean))]
}

function isDemonOrRedHerring(manager, game, playerId) {
  return isTeam(manager, game, playerId, ['demon']) ||
    game.statusEffects?.[playerId]?.red_herring === true
}

function withInfoCaution(game, actorId, summary) {
  const effects = game.statusEffects?.[actorId] || {}
  if (!effects.poisoned && !effects.drunk) return summary
  return `${summary} This player is poisoned or drunk, so the Storyteller may give false info.`
}

module.exports = {
  countEvilLivingNeighbors,
  countEvilPairs,
  getAssignedRole,
  getRoleName,
  getTargetIds,
  isDemonOrRedHerring,
  withInfoCaution
}
