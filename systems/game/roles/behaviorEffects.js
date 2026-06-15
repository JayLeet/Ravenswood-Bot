const {
  recordNightDeath
} = require('../night/NightDeathAnnouncements')

function markStatus(status, summary) {
  return async ({ manager, game, targetId, actorId }) => {
    if (!targetId) return { summary: 'No target selected.' }

    manager.reminders.setPlayerStatus(game, targetId, status, true, actorId)

    return {
      summary,
      targetId,
      status
    }
  }
}

function markExclusiveStatus(status, summary) {
  return async ({ manager, game, targetId, actorId }) => {
    if (!targetId) return { summary: 'No target selected.' }

    for (const playerId of manager.getPlayerIds(game)) {
      if (playerId === targetId || !game.statusEffects?.[playerId]?.[status]) continue
      manager.reminders.setPlayerStatus(game, playerId, status, false, actorId)
    }

    manager.reminders.setPlayerStatus(game, targetId, status, true, actorId)

    return {
      summary,
      targetId,
      status
    }
  }
}

async function killTarget({ manager, game, action, targetId, role, actorId, resolvedBy }) {
  if (!targetId) return { summary: 'No target selected.' }

  const attackerId = actorId || action?.actorId || action?.playerId || null
  if (attackerId && isDrunkOrPoisoned(game, attackerId)) {
    return {
      summary: 'The attacker was drunk or poisoned, so no one died.',
      targetId,
      prevented: true,
      preventedBy: 'attacker_status'
    }
  }

  if (game.statusEffects?.[targetId]?.protected) {
    return {
      summary: 'The target was protected from the demon attack.',
      targetId,
      prevented: true,
      preventedBy: 'protected'
    }
  }

  if (isDemonKillImmune(manager, game, action, role, targetId)) {
    return {
      summary: 'The target survived the demon attack.',
      targetId,
      prevented: true,
      preventedBy: 'ability'
    }
  }

  const aliveBeforeDeath = (game.alivePlayers || []).length
  manager.addDeadPlayer(game, targetId)
  manager.reminders.setPlayerStatus(game, targetId, 'dead', true, resolvedBy || game.storytellerId)
  recordNightDeath(game, targetId, 'demon_attack')

  await manager.roleEngine.handleDeath(manager, game, targetId, {
    action,
    aliveBeforeDeath,
    resolvedBy,
    source: 'night_action'
  })
  const roleTransfer = await maybeTransferImpOnSelfKill(manager, game, {
    action,
    actorId: attackerId,
    role,
    targetId,
    resolvedBy
  })

  await manager.emit('PLAYER_LIFE_STATE_CHANGED', {
    game,
    member: null,
    playerId: targetId,
    lifeState: 'dead',
    source: 'role_engine',
    action
  })

  return {
    summary: roleTransfer?.summary || 'The target was marked dead and will be announced at dawn.',
    targetId,
    lifeState: 'dead',
    roleTransfer
  }
}

async function maybeTransferImpOnSelfKill(manager, game, { action, actorId, role, targetId, resolvedBy }) {
  if (!isImpSelfKill(action, role, actorId, targetId)) return null
  if (hasLivingDemon(manager, game)) return null

  const minionIds = getLivingPlayersByTeam(manager, game, 'minion')
  if (minionIds.length !== 1) {
    return {
      summary: minionIds.length
        ? 'The Imp killed themselves. Storyteller should choose which living Minion becomes the Imp.'
        : 'The Imp killed themselves, but no living Minion could become the Imp.',
      candidateIds: minionIds,
      automatic: false
    }
  }

  const [newImpId] = minionIds
  game.roles ??= {}
  game.roles[newImpId] = 'imp'

  await manager.emit('PLAYER_ROLE_ASSIGNED', {
    game,
    member: null,
    playerId: newImpId,
    roleId: 'imp',
    source: 'imp_self_kill',
    resolvedBy
  })

  return {
    summary: 'The Imp killed themselves. The only living Minion became the Imp.',
    playerId: newImpId,
    roleId: 'imp',
    automatic: true
  }
}

function isImpSelfKill(action, role, actorId, targetId) {
  if (!actorId || actorId !== targetId) return false
  return (role?.id || action?.roleId) === 'imp'
}

function hasLivingDemon(manager, game) {
  return getLivingPlayersByTeam(manager, game, 'demon').length > 0
}

function getLivingPlayersByTeam(manager, game, team) {
  return (game.alivePlayers || []).filter(playerId => {
    const roleId = game.roles?.[playerId]
    return manager.scripts.getRole(game.scriptId, roleId)?.team === team
  })
}

function isDemonKillImmune(manager, game, action, role, targetId) {
  const attackerRole = role || manager.scripts.getRole(game.scriptId, action?.roleId)
  if (attackerRole?.team !== 'demon') return false

  const targetRoleId = game.roles?.[targetId]
  const targetRole = targetRoleId ? manager.scripts.getRole(game.scriptId, targetRoleId) : null
  const behavior = manager.roleEngine.getBehavior(manager, game, targetRole)

  return behavior?.preventsDemonKill === true && !isDrunkOrPoisoned(game, targetId)
}

function isDrunkOrPoisoned(game, playerId) {
  const effects = game.statusEffects?.[playerId] || {}
  return effects.drunk === true || effects.poisoned === true
}

function recordTarget(summary) {
  return async ({ targetId }) => ({
    summary: targetId ? summary : 'No target selected.',
    targetId
  })
}

function executionShield(type, options = {}) {
  return ({ game, playerId, targetId }) => {
    if (targetId !== playerId) return null
    if (type === 'fool' && game.executionShields?.foolSpent?.[playerId]) return null

    return {
      type,
      playerId,
      consumesFool: options.consumesFool === true
    }
  }
}

function teaLadyExecutionShield({ manager, game, playerId, targetId }) {
  if (!isAlive(game, playerId)) return null

  const neighbors = getAliveNeighbors(game, playerId)
  if (neighbors.length !== 2 || !neighbors.includes(targetId)) return null
  if (!neighbors.every(id => isGood(manager, game, id))) return null

  return {
    sourcePlayerId: playerId,
    type: 'tea_lady',
    playerId: targetId
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

module.exports = {
  executionShield,
  isDrunkOrPoisoned,
  killTarget,
  markStatus,
  markExclusiveStatus,
  recordTarget,
  teaLadyExecutionShield
}
