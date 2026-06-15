const roles = require('./index')
const {
  assignRoleWithDrunkRules,
  clearRoleWithDrunkRules
} = require('./drunkReassignment')
const {
  assignRandomScriptRoles
} = require('./randomRoleAssignment')
const {
  assignPendingManualImpReplacement,
  ensureManualDemonReplacement
} = require('./manualDemonDeath')
const {
  openManualKillReveal
} = require('./manualRevealState')
const {
  DRUNK_ROLE_ID
} = require('./setupCounts')
const {
  isClocktowerLiveMode
} = require('../../../utils/gameModes')
const {
  createClocktowerLiveFirstNightInfo
} = require('../lifecycle/ClocktowerLiveRoleVisuals')
const {
  getStorytellerControlledLobby,
  getStorytellerControlledPlayer
} = require('./RoleAssignmentGuards')
const {
  getRoleEmoji
} = require('../../../utils/storytellerDashboard/roleEmojis')

class RoleAssignmentService {
  constructor({ errorTypes }) {
    this.errorTypes = errorTypes
  }

  getStorytellerControlledPlayer(manager, guildId, member, playerId) {
    return getStorytellerControlledPlayer(this, manager, guildId, member, playerId)
  }

  getStorytellerControlledLobby(manager, guildId, member) {
    return getStorytellerControlledLobby(this, manager, guildId, member)
  }

  getScriptRoleIds(game) {
    return roles.getScriptRoleIds(game.scriptId)
  }

  formatScriptRole(manager, roleId, scriptId = manager.scripts.defaultScriptId) {
    const role = manager.scripts.getRole(scriptId, roleId)
    const name = role?.name || String(roleId || '')
      .split('_')
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')

    return `${getRoleEmoji(null, roleId)} The ${name}`
  }

  async assignScriptRole(manager, guildId, member, playerId, roleId) {
    const controlled = this.getStorytellerControlledPlayer(manager, guildId, member, playerId)
    if (!controlled.ok) return controlled

    const { game } = controlled

    if (!this.getScriptRoleIds(game).has(roleId)) {
      return manager.createError(this.errorTypes.INVALID_STATE, 'Unknown script role')
    }

    const assignment = assignRoleWithDrunkRules(game, playerId, roleId, {
      isTownsfolkRole: id => manager.scripts.getRole(game.scriptId, id)?.team === 'townsfolk'
    })

    await manager.emit('PLAYER_ROLE_ASSIGNED', {
      game,
      member,
      playerId,
      roleId: assignment.assignedRoleId
    })

    for (const converted of assignment.convertedPlayers) {
      if (converted.playerId === playerId) continue
      await manager.emit('PLAYER_ROLE_ASSIGNED', {
        game,
        member,
        playerId: converted.playerId,
        roleId: converted.roleId
      })
    }

    if (game.state === 'in-game' && game.phase === 'night') {
      await createRoleAssignmentNightInfo(manager, game, member)
    }

    manager.save()

    return manager.createSuccess({
      convertedPlayers: assignment.convertedPlayers,
      playerId,
      requestedRoleId: assignment.requestedRoleId,
      roleId: assignment.assignedRoleId,
      roleName: this.formatScriptRole(manager, assignment.assignedRoleId, game.scriptId),
      shownRoleId: assignment.shownRoleId || null,
      shownRoleName: assignment.shownRoleId
        ? this.formatScriptRole(manager, assignment.shownRoleId, game.scriptId)
        : null,
      view: manager.serializeGame(game, { guildId })
    })
  }

  async setDrunkShownRole(manager, guildId, member, playerId, shownRoleId) {
    const controlled = this.getStorytellerControlledPlayer(manager, guildId, member, playerId)
    if (!controlled.ok) return controlled

    const { game } = controlled
    const playerRoleId = game.roles?.[playerId]
    const shownRole = manager.scripts.getRole(game.scriptId, shownRoleId)

    if (playerRoleId !== DRUNK_ROLE_ID) {
      return manager.createError(this.errorTypes.INVALID_STATE, 'Select a player whose real role is Drunk first.')
    }

    if (!shownRole || shownRole.team !== 'townsfolk') {
      return manager.createError(this.errorTypes.INVALID_STATE, 'The Drunk must think they are a Townsfolk character.')
    }

    game.shownRoles ??= {}
    game.shownRoles[playerId] = shownRoleId

    await manager.emit('PLAYER_ROLE_ASSIGNED', {
      game,
      member,
      playerId,
      roleId: DRUNK_ROLE_ID
    })

    manager.save()

    return manager.createSuccess({
      playerId,
      roleId: DRUNK_ROLE_ID,
      roleName: this.formatScriptRole(manager, DRUNK_ROLE_ID, game.scriptId),
      shownRoleId,
      shownRoleName: this.formatScriptRole(manager, shownRoleId, game.scriptId),
      view: manager.serializeGame(game, { guildId })
    })
  }

  async assignRandomScriptRoles(manager, guildId, member, roleIds, options = {}) {
    return assignRandomScriptRoles(this, manager, guildId, member, roleIds, options)
  }

  async clearScriptRole(manager, guildId, member, playerId) {
    const controlled = this.getStorytellerControlledPlayer(manager, guildId, member, playerId)
    if (!controlled.ok) return controlled

    const { game } = controlled
    const assignment = clearRoleWithDrunkRules(game, playerId)

    await manager.emit('PLAYER_ROLE_ASSIGNED', {
      game,
      member,
      playerId,
      roleId: assignment.assignedRoleId
    })

    manager.save()

    return manager.createSuccess({
      convertedPlayers: assignment.convertedPlayers,
      playerId,
      roleId: assignment.assignedRoleId,
      roleName: assignment.assignedRoleId
        ? this.formatScriptRole(manager, assignment.assignedRoleId, game.scriptId)
        : null,
      view: manager.serializeGame(game, { guildId })
    })
  }

  async killPlayer(manager, guildId, member, playerId) {
    const controlled = this.getStorytellerControlledPlayer(manager, guildId, member, playerId)
    if (!controlled.ok) return controlled

    const { game } = controlled

    if ((game.deadPlayers || []).includes(playerId)) {
      return manager.createError(this.errorTypes.INVALID_STATE, 'That player is already dead')
    }

    const deadRoleId = game.roles?.[playerId] || null
    const aliveBeforeDeath = (game.alivePlayers || []).length
    manager.addDeadPlayer(game, playerId)
    await manager.roleEngine.handleDeath(manager, game, playerId, {
      aliveBeforeDeath,
      member,
      source: 'storyteller'
    })
    const replacement = await ensureManualDemonReplacement(manager, game, playerId, deadRoleId, {
      aliveBeforeDeath,
      member
    })

    await manager.emit('PLAYER_LIFE_STATE_CHANGED', {
      game,
      member,
      playerId,
      lifeState: 'dead'
    })

    if (replacement?.pendingChoice) {
      manager.save()
      return manager.createSuccess({
        playerId,
        lifeState: 'dead',
        replacement,
        view: manager.serializeGame(game, { guildId })
      })
    }

    const win = manager.evaluateWinConditions(game)
    if (win) return openManualKillReveal(manager, game, guildId, member, win, playerId)

    manager.save()

    return manager.createSuccess({
      playerId,
      lifeState: 'dead',
      replacement,
      view: manager.serializeGame(game, { guildId })
    })
  }

  async assignManualImpReplacement(manager, guildId, member, playerId, requestId) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(this.errorTypes.NOT_FOUND, 'No game')
    if (!manager.isStoryteller(game, member.id)) {
      return manager.createError(this.errorTypes.PERMISSION_DENIED, 'Not storyteller')
    }

    const replacement = await assignPendingManualImpReplacement(manager, game, playerId, requestId, member)
    if (!replacement) {
      return manager.createError(
        this.errorTypes.INVALID_STATE,
        'That Imp replacement choice is no longer available.'
      )
    }

    manager.save()
    return manager.createSuccess({
      playerId,
      replacement,
      view: manager.serializeGame(game, { guildId })
    })
  }

  async revivePlayer(manager, guildId, member, playerId) {
    const controlled = this.getStorytellerControlledPlayer(manager, guildId, member, playerId)
    if (!controlled.ok) return controlled

    const { game } = controlled

    if ((game.alivePlayers || []).includes(playerId)) {
      return manager.createError(this.errorTypes.INVALID_STATE, 'That player is already alive')
    }

    game.deadPlayers = (game.deadPlayers || []).filter(id => id !== playerId)
    game.alivePlayers ??= []
    if (!game.alivePlayers.includes(playerId)) game.alivePlayers.push(playerId)
    if (game.deadVotes) delete game.deadVotes[playerId]

    await manager.emit('PLAYER_LIFE_STATE_CHANGED', {
      game,
      member,
      playerId,
      lifeState: 'alive'
    })

    manager.save()

    return manager.createSuccess({
      playerId,
      lifeState: 'alive',
      view: manager.serializeGame(game, { guildId })
    })
  }
}

function createRoleAssignmentNightInfo(manager, game, member) {
  if (isClocktowerLiveMode(game)) return createClocktowerLiveFirstNightInfo(manager, game, member)
  return manager.roleEngine.createNightActionsForPhase(manager, game, {
    createdBy: member.id,
    reason: 'role-assigned'
  })
}

module.exports = RoleAssignmentService
