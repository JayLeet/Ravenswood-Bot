const {
  DRUNK_ROLE_ID,
  validateSetupSelection
} = require('./setupCounts')

async function assignRandomScriptRoles(service, manager, guildId, member, roleIds, options = {}) {
  const controlled = service.getStorytellerControlledLobby(manager, guildId, member)
  if (!controlled.ok) return controlled

  const { game } = controlled
  const playerIds = manager.getPlayerIds(game)
  const script = manager.scripts.getScript(game.scriptId)

  if (!playerIds.length) {
    return manager.createError(service.errorTypes.INVALID_STATE, 'Add players before randomizing roles.')
  }

  const setup = validateSetupSelection(script, roleIds, playerIds.length, options)
  if (!setup.ok) return manager.createError(service.errorTypes.INVALID_STATE, setup.message)

  const assignments = applyRandomAssignments(service, manager, game, playerIds, setup)

  await manager.emit('PLAYER_ROLES_RANDOMIZED', {
    game,
    member,
    assignments
  })

  manager.save()

  return manager.createSuccess({
    assignments,
    view: manager.serializeGame(game, { guildId })
  })
}

function applyRandomAssignments(service, manager, game, playerIds, setup) {
  const shuffledRoles = shuffle(setup.actualRoleIds)
  game.roles ??= {}
  game.shownRoles = {}

  return playerIds.map((playerId, index) => {
    const roleId = shuffledRoles[index]
    game.roles[playerId] = roleId
    if (roleId === DRUNK_ROLE_ID && setup.shownRoleId) game.shownRoles[playerId] = setup.shownRoleId

    return {
      playerId,
      roleId,
      roleName: service.formatScriptRole(manager, roleId, game.scriptId),
      shownRoleId: game.shownRoles[playerId] || null,
      shownRoleName: game.shownRoles[playerId]
        ? service.formatScriptRole(manager, game.shownRoles[playerId], game.scriptId)
        : null
    }
  })
}

function shuffle(values) {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = result[index]
    result[index] = result[swapIndex]
    result[swapIndex] = current
  }
  return result
}

module.exports = {
  assignRandomScriptRoles
}
