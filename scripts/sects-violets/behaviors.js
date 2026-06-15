const {
  isDrunkOrPoisoned
} = require('../../systems/game/roles/behaviorEffects')

/** @type {Record<string, import('../../types').RoleBehaviorDefinition>} */
module.exports = {
  snake_charmer: {
    nightAction: {
      prompt: 'Choose a living player to charm.',
      target: 'living-player',
      allowSelf: false
    },
    onNight: snakeCharmerSwap
  }
}

async function snakeCharmerSwap({ manager, game, actorId, targetId, resolvedBy }) {
  if (!targetId) return { summary: 'No target selected.' }
  if (isDrunkOrPoisoned(game, actorId)) {
    return {
      summary: 'The Snake Charmer was drunk or poisoned, so no roles changed.',
      prevented: true,
      preventedBy: 'actor_status',
      targetId
    }
  }

  const targetRoleId = game.roles?.[targetId] || null
  const targetRole = targetRoleId ? manager.scripts.getRole(game.scriptId, targetRoleId) : null
  if (targetRole?.team !== 'demon') {
    return {
      summary: 'The Snake Charmer chose a non-Demon, so no roles changed.',
      swapped: false,
      targetId
    }
  }

  game.roles ??= {}
  game.roles[actorId] = targetRoleId
  game.roles[targetId] = 'snake_charmer'
  markOldDemonPoisoned(manager, game, targetId, actorId)

  await emitRoleAssigned(manager, game, actorId, targetRoleId, resolvedBy)
  await emitRoleAssigned(manager, game, targetId, 'snake_charmer', resolvedBy)

  return {
    summary: 'The Snake Charmer chose the Demon. Their characters were swapped.',
    actorId,
    actorRoleId: targetRoleId,
    oldDemonId: targetId,
    oldDemonRoleId: 'snake_charmer',
    poisonedPlayerId: targetId,
    swapped: true
  }
}

function markOldDemonPoisoned(manager, game, playerId, actorId) {
  if (manager.reminders?.setPlayerStatus) {
    manager.reminders.setPlayerStatus(game, playerId, 'poisoned', true, actorId)
    return
  }

  game.statusEffects ??= {}
  game.statusEffects[playerId] ??= {}
  game.statusEffects[playerId].poisoned = true
}

async function emitRoleAssigned(manager, game, playerId, roleId, resolvedBy) {
  await manager.emit?.('PLAYER_ROLE_ASSIGNED', {
    game,
    member: null,
    playerId,
    resolvedBy,
    roleId,
    source: 'snake_charmer'
  })
}
