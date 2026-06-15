const {
  DRUNK_ROLE_ID
} = require('./setupCounts')

function assignRoleWithDrunkRules(game, playerId, roleId, options = {}) {
  game.roles ??= {}
  game.shownRoles ??= {}

  const previousRoleId = game.roles[playerId]

  if (roleId === DRUNK_ROLE_ID) {
    const convertedPlayers = convertOtherDrunks(game, playerId)
    game.roles[playerId] = DRUNK_ROLE_ID

    const shownRoleId = options.isTownsfolkRole?.(previousRoleId)
      ? previousRoleId
      : null

    if (shownRoleId) game.shownRoles[playerId] = shownRoleId
    else delete game.shownRoles[playerId]

    return {
      assignedRoleId: DRUNK_ROLE_ID,
      convertedPlayers,
      previousRoleId,
      requestedRoleId: roleId,
      shownRoleId
    }
  }

  if (previousRoleId === DRUNK_ROLE_ID && game.shownRoles[playerId]) {
    const shownRoleId = game.shownRoles[playerId]
    game.roles[playerId] = shownRoleId
    delete game.shownRoles[playerId]

    return {
      assignedRoleId: shownRoleId,
      convertedPlayers: [{ playerId, roleId: shownRoleId }],
      previousRoleId,
      requestedRoleId: roleId,
      shownRoleId: null
    }
  }

  game.roles[playerId] = roleId
  delete game.shownRoles[playerId]

  return {
    assignedRoleId: roleId,
    convertedPlayers: [],
    previousRoleId,
    requestedRoleId: roleId,
    shownRoleId: null
  }
}

function clearRoleWithDrunkRules(game, playerId) {
  game.roles ??= {}
  game.shownRoles ??= {}

  const previousRoleId = game.roles[playerId]
  if (previousRoleId === DRUNK_ROLE_ID && game.shownRoles[playerId]) {
    const shownRoleId = game.shownRoles[playerId]
    game.roles[playerId] = shownRoleId
    delete game.shownRoles[playerId]

    return {
      assignedRoleId: shownRoleId,
      cleared: false,
      convertedPlayers: [{ playerId, roleId: shownRoleId }],
      previousRoleId
    }
  }

  delete game.roles[playerId]
  delete game.shownRoles[playerId]

  return {
    assignedRoleId: null,
    cleared: true,
    convertedPlayers: [],
    previousRoleId
  }
}

function convertOtherDrunks(game, targetPlayerId) {
  const convertedPlayers = []
  for (const [otherPlayerId, otherRoleId] of Object.entries(game.roles || {})) {
    if (otherPlayerId === targetPlayerId || otherRoleId !== DRUNK_ROLE_ID) continue

    const shownRoleId = game.shownRoles?.[otherPlayerId]
    if (shownRoleId) {
      game.roles[otherPlayerId] = shownRoleId
      convertedPlayers.push({ playerId: otherPlayerId, roleId: shownRoleId })
    } else {
      delete game.roles[otherPlayerId]
      convertedPlayers.push({ playerId: otherPlayerId, roleId: null })
    }

    delete game.shownRoles[otherPlayerId]
  }

  return convertedPlayers
}

module.exports = {
  assignRoleWithDrunkRules,
  clearRoleWithDrunkRules
}
