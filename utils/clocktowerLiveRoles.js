const {
  isClocktowerLiveMode
} = require('./gameModes')

function hasCompleteAssignedRoles(gameOrView) {
  const players = getPlayers(gameOrView)
  const roles = getRoles(gameOrView)
  return players.length > 0 && players.every(playerId => Boolean(roles[playerId]))
}

function hasCompleteValidRoles(manager, game) {
  if (!hasCompleteAssignedRoles(game)) return false
  return getPlayers(game).every(playerId =>
    Boolean(manager?.scripts?.getRole?.(game.scriptId, game.roles?.[playerId]))
  )
}

function shouldUseClocktowerLiveRoleVisuals(manager, game) {
  return isClocktowerLiveMode(game) && hasCompleteValidRoles(manager, game)
}

function getPlayers(gameOrView) {
  return gameOrView?.users?.players ||
    Object.entries(gameOrView?.users || {})
      .filter(([, user]) => user?.role === 'player')
      .map(([playerId]) => playerId)
}

function getRoles(gameOrView) {
  return gameOrView?.engine?.roles || gameOrView?.roles || {}
}

module.exports = {
  hasCompleteAssignedRoles,
  hasCompleteValidRoles,
  shouldUseClocktowerLiveRoleVisuals
}
