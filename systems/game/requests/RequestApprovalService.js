class RequestApprovalService {
  constructor({ errorTypes }) {
    this.errorTypes = errorTypes
  }

  getPendingRequestsForStoryteller(requests, manager, guildId, member) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(this.errorTypes.NOT_FOUND, 'No active game')
    if (!manager.isStoryteller(game, member.id)) {
      return manager.createError(this.errorTypes.PERMISSION_DENIED, 'Only Storyteller can view pending requests')
    }
    return requests.getPendingRequests(game)
  }

  async approveRequest(requests, manager, guildId, member, requestId, requestedMember) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(this.errorTypes.NOT_FOUND, 'No active game')
    if (!manager.isStoryteller(game, member.id)) {
      return manager.createError(this.errorTypes.PERMISSION_DENIED, 'Only Storyteller can approve requests')
    }

    const pending = requests.getPendingRequest(game, requestId)
    if (!pending.ok) return pending

    const request = pending.request
    const requestedUserId = request.userId
    if (!requestedMember || requestedMember.id !== requestedUserId) {
      return manager.createError(this.errorTypes.INVALID_STATE, 'Requested member does not match request')
    }

    const existingRole = manager.getRole(game, requestedUserId)
    if (!this.canApproveRequestForExistingRole(manager, game, request, requestedMember, existingRole)) {
      return manager.createError(this.errorTypes.ALREADY_IN_GAME, 'User is already in game')
    }

    const result = await this.approveByType(manager, game, guildId, request, requestedMember)
    if (!result.ok) return result

    requests.markApproved(game, request, member.id)
    manager.save()

    return manager.createSuccess({
      request,
      view: manager.serializeGame(game, { guildId })
    })
  }

  canApproveRequestForExistingRole(manager, game, request, requestedMember, existingRole) {
    if (!existingRole) return true
    if (request.type === 'grimoire') return true
    return request.type === 'join' &&
      existingRole === 'spectator' &&
      !!game.paused &&
      !manager.gameManager.hasGrimoireSpectatorRole(requestedMember)
  }

  async approveByType(manager, game, guildId, request, requestedMember) {
    if (request.type === 'join') return this.approveJoin(manager, game, guildId, requestedMember)
    if (request.type === 'grimoire') return this.approveGrimoireAccess(manager, game, requestedMember)
    return manager.createError(this.errorTypes.INVALID_STATE, 'Unknown request type')
  }

  async approveJoin(manager, game, guildId, requestedMember) {
    const replacement = game.replacementSlot?.oldPlayerId
    if (!replacement) return this.approveNewPlayerJoin(manager, game, guildId, requestedMember)

    const spectatorConverted = await this.convertSpectatorToPlayerIfNeeded(manager, game, requestedMember)
    if (!spectatorConverted.ok) return spectatorConverted

    const roleAdded = await manager.gameManager.addPlayerRole(requestedMember)
    if (!roleAdded) return manager.createError(this.errorTypes.TRANSACTION_FAILED, 'Could not assign Player role')

    const substituted = manager.admin.substitutePlayer(manager, game, replacement, requestedMember)
    if (!substituted.ok) return substituted

    this.transferSubstituteDeadVote(game, replacement, requestedMember.id)
    await this.setApprovedPlayerNickname(manager, requestedMember)
    await manager.emit('PLAYER_SUBSTITUTED', {
      game,
      oldPlayerId: replacement,
      member: requestedMember
    })
    await manager.emit('PLAYER_JOINED', { game, member: requestedMember })
    return manager.createSuccess()
  }

  async approveNewPlayerJoin(manager, game, guildId, requestedMember) {
    const playerCount = Object.values(game.users).filter(user => user.role === 'player' && !user.kicked).length
    if (playerCount >= game.maxPlayers) return manager.createError(this.errorTypes.GAME_FULL, 'Game full')

    const spectatorConverted = await this.convertSpectatorToPlayerIfNeeded(manager, game, requestedMember)
    if (!spectatorConverted.ok) return spectatorConverted

    const roleAdded = await manager.gameManager.addPlayerRole(requestedMember)
    if (!roleAdded) return manager.createError(this.errorTypes.TRANSACTION_FAILED, 'Could not assign Player role')

    manager.setRole(game, requestedMember.id, 'player')
    manager.addAlivePlayer(game, requestedMember.id)
    await this.setApprovedPlayerNickname(manager, requestedMember)
    await manager.emit('PLAYER_JOINED', { game, member: requestedMember })
    return manager.createSuccess()
  }

  async convertSpectatorToPlayerIfNeeded(manager, game, member) {
    if (manager.getRole(game, member.id) !== 'spectator') return manager.createSuccess()

    const spectatorRemoved = await manager.gameManager.removeSpectatorRole(member)
    if (!spectatorRemoved) {
      return manager.createError(this.errorTypes.TRANSACTION_FAILED, 'Could not remove Spectator role')
    }
    await manager.gameManager.removeGrimoireSpectatorRole(member)
    return manager.createSuccess()
  }

  transferSubstituteDeadVote(game, oldPlayerId, newPlayerId) {
    game.deadVotes ??= {}
    if (Object.prototype.hasOwnProperty.call(game.deadVotes, newPlayerId)) return
    if (!Object.prototype.hasOwnProperty.call(game.deadVotes, oldPlayerId)) return
    game.deadVotes[newPlayerId] = game.deadVotes[oldPlayerId]
    delete game.deadVotes[oldPlayerId]
  }

  async setApprovedPlayerNickname(manager, member) {
    await manager.gameManager.setNickname(member, 'player')
  }

  async approveGrimoireAccess(manager, game, requestedMember) {
    if (manager.getRole(game, requestedMember.id) !== 'spectator') {
      return manager.createError(this.errorTypes.PERMISSION_DENIED, 'Only spectators can receive grimoire access.')
    }

    const roleAdded = await manager.gameManager.addGrimoireSpectatorRole(requestedMember)
    if (!roleAdded) return manager.createError(this.errorTypes.TRANSACTION_FAILED, 'Could not assign grimoire spectator role')

    await manager.gameManager.setNickname(requestedMember, 'grimoireSpectator')
    return manager.createSuccess()
  }

  async rejectRequest(requests, manager, guildId, member, requestId) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(this.errorTypes.NOT_FOUND, 'No active game')
    if (!manager.isStoryteller(game, member.id)) {
      return manager.createError(this.errorTypes.PERMISSION_DENIED, 'Only Storyteller can reject requests')
    }

    const rejected = requests.rejectPendingRequest(game, requestId, member.id)
    if (!rejected.ok) return rejected
    manager.save()
    return manager.createSuccess({ request: rejected.request })
  }
}

module.exports = RequestApprovalService
