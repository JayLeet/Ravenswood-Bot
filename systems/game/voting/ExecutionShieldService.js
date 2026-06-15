class ExecutionShieldService {
  find(manager, game, playerId) {
    if (!playerId) return null

    const statusShield = this.findStatusShield(game, playerId)
    if (statusShield) return statusShield

    return this.findBuiltInRoleShield(manager, game, playerId)
  }

  async findForExecution(manager, game, playerId, context = {}) {
    if (!playerId) return null

    const statusShield = this.findStatusShield(game, playerId)
    if (statusShield) return statusShield

    const behaviorShield = await manager.roleEngine?.findExecutionShield?.(manager, game, playerId, context)
    if (behaviorShield) return behaviorShield

    return this.findBuiltInRoleShield(manager, game, playerId)
  }

  findStatusShield(game, playerId) {
    if (game.statusEffects?.[playerId]?.protected) {
      return { type: 'status', playerId, consumesStatus: true }
    }
    return null
  }

  findBuiltInRoleShield(manager, game, playerId) {
    const roleId = game.roles?.[playerId]
    if (roleId === 'fool' && !game.executionShields?.foolSpent?.[playerId]) {
      return { type: 'fool', playerId, consumesFool: true }
    }

    if (roleId === 'sailor') return { type: 'sailor', playerId }

    return this.findTeaLadyShield(manager, game, playerId)
  }

  findTeaLadyShield(manager, game, playerId) {
    const teaLadyId = Object.entries(game.roles || {})
      .find(([id, roleId]) => roleId === 'tea_lady' && isAlive(game, id))?.[0]
    if (!teaLadyId) return null

    const neighbors = getAliveNeighbors(game, teaLadyId)
    if (neighbors.length !== 2 || !neighbors.includes(playerId)) return null
    if (!neighbors.every(id => isGood(manager, game, id))) return null

    return { type: 'tea_lady', playerId, sourcePlayerId: teaLadyId }
  }

  consume(manager, game, shield, actorId) {
    if (!shield) return

    if (shield.consumesFool) {
      game.executionShields ??= {}
      game.executionShields.foolSpent ??= {}
      game.executionShields.foolSpent[shield.playerId] = true
    }

    if (shield.consumesStatus) {
      manager.reminders.setPlayerStatus(game, shield.playerId, 'protected', false, actorId)
    }
  }
}

function getAliveNeighbors(game, playerId) {
  const alive = new Set(game.alivePlayers || [])
  const players = Object.entries(game.users || {})
    .filter(([, data]) => data.role === 'player')
    .map(([id]) => id)
  const index = players.indexOf(playerId)
  if (index === -1 || players.length < 3) return []

  return [
    findAliveNeighbor(players, alive, index, -1),
    findAliveNeighbor(players, alive, index, 1)
  ].filter(Boolean)
}

function findAliveNeighbor(players, alive, startIndex, direction) {
  for (let offset = 1; offset < players.length; offset += 1) {
    const index = (startIndex + (offset * direction) + players.length) % players.length
    const playerId = players[index]
    if (alive.has(playerId)) return playerId
  }

  return null
}

function isGood(manager, game, playerId) {
  const roleId = game.roles?.[playerId]
  const role = roleId ? manager.scripts.getRole(game.scriptId, roleId) : null
  return ['townsfolk', 'outsider'].includes(role?.team)
}

function isAlive(game, playerId) {
  return (game.alivePlayers || []).includes(playerId)
}

module.exports = ExecutionShieldService
