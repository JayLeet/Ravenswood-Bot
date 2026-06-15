let nightActionSequence = 0

class NightActionService {
  countByStatus(game) {
    const counts = { awaiting: 0, submitted: 0, resolved: 0, cancelled: 0, unresolved: 0 }

    for (const action of game.nightActions || []) {
      if (action.status === 'awaiting_target') counts.awaiting += 1
      if (action.status === 'submitted') counts.submitted += 1
      if (action.status === 'resolved') counts.resolved += 1
      if (action.status === 'cancelled') counts.cancelled += 1
    }

    counts.unresolved = counts.awaiting + counts.submitted
    return counts
  }

  createStorytellerAction(game, { guildId, playerId, type, createdBy }) {
    const action = {
      id: createNightActionId(game, 'st'),
      guildId,
      type,
      playerId,
      day: game.day,
      phase: game.phase,
      createdAt: Date.now(),
      createdBy
    }

    game.nightActions ??= []
    game.nightActions.push(action)
    return action
  }

  createTargetAction(game, input) {
    const {
      guildId,
      playerId,
      roleId = null,
      createdBy,
      source = 'storyteller',
      autoPrompt = false,
      behaviorId = null,
      roleName = null,
      prompt = null,
      targetType = 'player',
      targetCount = 1,
      allowSelf = true,
      allowDeadActor = false,
      purpose = 'night_action',
      infoOnly = false,
      skipRoleHook = false
    } = input
    const action = {
      id: createNightActionId(game, 'nt'),
      guildId,
      type: 'night_target',
      source,
      status: 'awaiting_target',
      actorId: playerId,
      playerId,
      roleId,
      behaviorId,
      roleName,
      prompt,
      targetType,
      targetCount,
      allowSelf,
      allowDeadActor,
      autoPrompt,
      purpose,
      infoOnly,
      skipRoleHook,
      targetId: null,
      targetIds: [],
      day: game.day,
      phase: game.phase,
      createdAt: Date.now(),
      createdBy,
      resolvedAt: null,
      resolvedBy: null
    }

    game.nightActions ??= []
    game.nightActions.push(action)
    return action
  }

  findAction(game, actionId) {
    return (game.nightActions || []).find(action => action.id === actionId) || null
  }

  setPrompt(game, actionId, channelId, messageId) {
    const action = this.findAction(game, actionId)
    if (!action) return null

    action.promptChannelId = channelId
    action.promptMessageId = messageId
    return action
  }

  submitTarget(action, targetIds) {
    const ids = this.normalizeTargetIds(targetIds)
    action.targetIds = ids
    action.targetId = ids[0] || null
    action.status = 'submitted'
    action.submittedAt = Date.now()
    return action
  }

  submitText(action, text) {
    action.responseText = String(text || '')
    action.targetType = 'text'
    action.targetIds = []
    action.targetId = null
    action.status = 'submitted'
    action.submittedAt = Date.now()
    return action
  }

  findLatestSubmittedForPlayer(game, playerId) {
    return [...(game.nightActions || [])].reverse().find(item =>
      (item.actorId === playerId || item.playerId === playerId) &&
      item.status === 'submitted' &&
      item.day === game.day &&
      item.phase === game.phase
    ) || null
  }

  resolve(action, resolvedBy) {
    action.status = 'resolved'
    action.resolvedAt = Date.now()
    action.resolvedBy = resolvedBy
    return action
  }

  resolveInfoOnly(action, resolvedBy) {
    if (!action.infoOnly) return action
    action.responseText = 'First-night information sent.'
    return this.resolve(action, resolvedBy)
  }

  async recordStorytellerAction(manager, guildId, member, playerId, type) {
    const controlled = manager.getStorytellerControlledPlayer(guildId, member, playerId)
    if (!controlled.ok) return controlled

    const { game } = controlled
    const action = this.createStorytellerAction(game, { guildId, type, playerId, createdBy: member.id })

    await manager.emit('STORYTELLER_ACTION_RECORDED', { game, member, playerId, action })
    manager.save()

    return manager.createSuccess({ playerId, action, view: manager.serializeGame(game, { guildId }) })
  }

  async createNightTargetAction(manager, guildId, member, playerId) {
    const controlled = manager.getStorytellerControlledPlayer(guildId, member, playerId)
    if (!controlled.ok) return controlled

    const { game } = controlled
    const action = this.createTargetAction(game, {
      guildId,
      playerId,
      roleId: game.roles?.[playerId] || null,
      createdBy: member.id
    })

    await manager.emit('NIGHT_ACTION_CREATED', { game, member, playerId, action })
    manager.save()

    return manager.createSuccess({ playerId, action, view: manager.serializeGame(game, { guildId }) })
  }

  async submitNightActionTarget(manager, guildId, member, actionId, targetId) {
    const prepared = this.prepareSubmit(manager, guildId, member, actionId)
    if (!prepared.ok) return prepared

    const { game, action } = prepared
    const targetValidation = this.validateTarget(manager, game, action, targetId)
    if (!targetValidation.ok) return targetValidation

    this.submitTarget(action, targetId)
    return this.finishSubmit(manager, guildId, member, game, action)
  }

  async submitNightActionText(manager, guildId, member, actionId, text) {
    const prepared = this.prepareSubmit(manager, guildId, member, actionId)
    if (!prepared.ok) return prepared

    const { game, action } = prepared
    this.submitText(action, text)
    return this.finishSubmit(manager, guildId, member, game, action)
  }

  prepareSubmit(manager, guildId, member, actionId) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(manager.errorTypes.NOT_FOUND, 'No game')

    const action = this.findAction(game, actionId)
    if (!action) return manager.createError(manager.errorTypes.NOT_FOUND, 'Night action not found')

    if (action.actorId !== member.id && action.playerId !== member.id) {
      return manager.createError(manager.errorTypes.PERMISSION_DENIED, 'Only the woken player can submit this action')
    }

    if (action.status !== 'awaiting_target') {
      return manager.createError(manager.errorTypes.INVALID_STATE, 'That night action is no longer waiting for a target')
    }

    if (game.state !== 'in-game' || action.day !== game.day || action.phase !== game.phase) {
      return manager.createError(manager.errorTypes.INVALID_STATE, 'That night action is no longer active')
    }

    return manager.createSuccess({ game, action })
  }

  async finishSubmit(manager, guildId, member, game, action) {
    await manager.emit('NIGHT_ACTION_SUBMITTED', { game, member, action })
    manager.save()
    return manager.createSuccess({ action, view: manager.serializeGame(game, { guildId }) })
  }

  async resolveLatestNightAction(manager, guildId, member, playerId) {
    const controlled = manager.getStorytellerControlledPlayer(guildId, member, playerId)
    if (!controlled.ok) return controlled

    const { game } = controlled
    const action = this.findLatestSubmittedForPlayer(game, playerId)
    if (!action) return manager.createError(manager.errorTypes.NOT_FOUND, 'No submitted night action for that player')

    this.resolve(action, member.id)
    const roleResult = await manager.roleEngine.resolveNightAction(manager, game, action, member.id)

    await manager.emit('NIGHT_ACTION_RESOLVED', { game, member, playerId, action, roleResult })

    const win = manager.evaluateWinConditions(game)
    if (win) return manager.forceEnd(game, win, member.guild)

    manager.save()
    return manager.createSuccess({ action, roleResult, view: manager.serializeGame(game, { guildId }) })
  }

  validateTarget(manager, game, action, targetId) {
    const targetIds = this.normalizeTargetIds(targetId)
    const targetCount = Math.max(1, Number(action.targetCount) || 1)

    if (targetIds.length !== targetCount) {
      return manager.createError(manager.errorTypes.INVALID_STATE, `Choose exactly ${targetCount} target${targetCount === 1 ? '' : 's'}`)
    }

    for (const id of targetIds) {
      if (manager.getRole(game, id) !== 'player') return manager.createError(manager.errorTypes.INVALID_STATE, 'That target is not a player')
      if (action.allowSelf === false && id === (action.actorId || action.playerId)) return manager.createError(manager.errorTypes.INVALID_STATE, 'That action cannot target yourself')
      if (action.targetType === 'living-player' && !(game.alivePlayers || []).includes(id)) return manager.createError(manager.errorTypes.INVALID_STATE, 'That target is not alive')
      if (action.targetType === 'dead-player' && !(game.deadPlayers || []).includes(id)) return manager.createError(manager.errorTypes.INVALID_STATE, 'That target is not dead')
      if (action.targetType === 'self' && id !== (action.actorId || action.playerId)) return manager.createError(manager.errorTypes.INVALID_STATE, 'That action must target yourself')
    }

    return manager.createSuccess()
  }

  normalizeTargetIds(targetIds) {
    const ids = Array.isArray(targetIds) ? targetIds : [targetIds]
    return [...new Set(ids.filter(Boolean))]
  }
}

function createNightActionId(game, prefix) {
  game.nextNightActionId = Number(game.nextNightActionId || 0) + 1
  nightActionSequence = (nightActionSequence + 1) % 46656
  return `${prefix}${game.nextNightActionId.toString(36)}${nightActionSequence.toString(36)}`
}

module.exports = NightActionService
