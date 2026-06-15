function assignRoleWithHistory(game, playerId, roleId, source = null) {
  game.roles ??= {}
  game.roleHistory ??= {}
  game.shownRoles ??= {}

  const previousRoleId = game.roles[playerId] || null
  if (previousRoleId && previousRoleId !== roleId) {
    game.roleHistory[playerId] ??= []
    game.roleHistory[playerId].push({
      roleId: previousRoleId,
      changedAt: Date.now(),
      source
    })
  }

  game.roles[playerId] = roleId
  delete game.shownRoles[playerId]

  return { previousRoleId, roleId }
}

module.exports = {
  assignRoleWithHistory
}
