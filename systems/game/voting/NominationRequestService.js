class NominationRequestService {
  constructor(voting) {
    this.voting = voting
  }

  createRequest(manager, guildId, member, nomineeId) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(manager.errorTypes.NOT_FOUND, 'No game')

    this.cancelDeadNominatorRequests(manager, game)

    const validation = this.voting.nominations.validateNomination(manager, game, member.id, nomineeId)
    if (!validation.ok) return validation

    const duplicate = this.findPendingByNominator(game, member.id)
    if (duplicate) {
      return manager.createError(
        manager.errorTypes.INVALID_STATE,
        'You already have a pending nomination request.'
      )
    }

    const request = this.createRecord(game, guildId, member.id, nomineeId)
    game.nominationRequests ??= []
    game.nominationRequests.push(request)
    manager.save()

    return manager.createSuccess({
      request,
      queuePosition: this.getPendingRequests(game).length
    })
  }

  async approveRequest(manager, guildId, member, requestId) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(manager.errorTypes.NOT_FOUND, 'No game')

    this.cancelDeadNominatorRequests(manager, game)

    const request = this.getPendingRequest(game, requestId)
    if (!request) return manager.createError(manager.errorTypes.NOT_FOUND, 'Nomination request not found')

    const storyteller = this.validateStoryteller(manager, game, member)
    if (!storyteller.ok) return storyteller

    return this.approvePendingRequest(manager, guildId, member, request)
  }

  async approveMatchingRequest(manager, guildId, member, nominatorId, nomineeId) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(manager.errorTypes.NOT_FOUND, 'No game')

    this.cancelDeadNominatorRequests(manager, game)

    const storyteller = this.validateStoryteller(manager, game, member)
    if (!storyteller.ok) return storyteller

    const request = this.findPendingByPair(game, nominatorId, nomineeId)
    if (!request) return null
    return this.approvePendingRequest(manager, guildId, member, request)
  }

  async approvePendingRequest(manager, guildId, member, request) {
    const result = await this.voting.createNomination(manager, guildId, member, request.nomineeId, {
      bypassApproval: true,
      nominatorId: request.nominatorId
    })
    if (!result.ok) return result

    request.status = 'approved'
    request.resolvedAt = Date.now()
    request.resolvedBy = member.id
    request.nominationId = result.nomination.id
    manager.save()

    return manager.createSuccess({
      request,
      nomination: result.nomination,
      view: result.view
    })
  }

  rejectRequest(manager, guildId, member, requestId) {
    return this.resolveRequest(manager, guildId, member, requestId, 'rejected')
  }

  cancelRequest(manager, guildId, member, requestId) {
    return this.resolveRequest(manager, guildId, member, requestId, 'cancelled')
  }

  rescindOwnRequest(manager, guildId, member) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(manager.errorTypes.NOT_FOUND, 'No game')

    this.cancelDeadNominatorRequests(manager, game)

    const request = this.findPendingByNominator(game, member.id)
    if (!request) {
      return manager.createError(
        manager.errorTypes.NOT_FOUND,
        'You do not have a pending nomination request to rescind.'
      )
    }

    return this.markRescinded(manager, request, member.id)
  }

  rescindRequest(manager, guildId, member, requestId) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(manager.errorTypes.NOT_FOUND, 'No game')

    this.cancelDeadNominatorRequests(manager, game)

    const request = this.getPendingRequest(game, requestId)
    if (!request) return manager.createError(manager.errorTypes.NOT_FOUND, 'Nomination request not found')

    if (request.nominatorId !== member.id) {
      return manager.createError(
        manager.errorTypes.PERMISSION_DENIED,
        'Only the nominator can rescind this nomination request.'
      )
    }

    return this.markRescinded(manager, request, member.id)
  }

  markRescinded(manager, request, userId) {
    request.status = 'rescinded'
    request.resolvedAt = Date.now()
    request.resolvedBy = userId
    manager.save()

    return manager.createSuccess({ request })
  }

  resolveRequest(manager, guildId, member, requestId, status) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(manager.errorTypes.NOT_FOUND, 'No game')

    this.cancelDeadNominatorRequests(manager, game)

    const request = this.getPendingRequest(game, requestId)
    if (!request) return manager.createError(manager.errorTypes.NOT_FOUND, 'Nomination request not found')

    const storyteller = this.validateStoryteller(manager, game, member)
    if (!storyteller.ok) return storyteller

    request.status = status
    request.resolvedAt = Date.now()
    request.resolvedBy = member.id
    manager.save()

    return manager.createSuccess({ request })
  }

  cancelDeadNominatorRequests(manager, game) {
    let changed = false
    const alive = new Set(game.alivePlayers || [])

    for (const request of game.nominationRequests || []) {
      if (request.status !== 'pending') continue
      if (alive.has(request.nominatorId)) continue

      request.status = 'cancelled'
      request.resolvedAt = Date.now()
      request.resolvedBy = 'system:dead-nominator'
      request.cancelReason = 'nominator_died'
      changed = true
    }

    if (changed) manager.save()
    return changed
  }

  getPendingRequests(game) {
    const alive = new Set(game.alivePlayers || [])

    return (game.nominationRequests || [])
      .filter(request => request.status === 'pending')
      .filter(request => alive.has(request.nominatorId))
      .sort((a, b) => a.createdAt - b.createdAt)
  }

  getPendingRequest(game, requestId) {
    return this.getPendingRequests(game).find(request => request.id === requestId) || null
  }

  findPendingByNominator(game, nominatorId) {
    return this.getPendingRequests(game).find(request => request.nominatorId === nominatorId) || null
  }

  findPendingByPair(game, nominatorId, nomineeId) {
    return this.getPendingRequests(game).find(request =>
      request.nominatorId === nominatorId && request.nomineeId === nomineeId
    ) || null
  }

  createRecord(game, guildId, nominatorId, nomineeId) {
    return {
      id: `${Date.now()}-nomination-request-${nominatorId}-${nomineeId}`,
      guildId,
      day: game.day || 1,
      nominatorId,
      nomineeId,
      status: 'pending',
      createdAt: Date.now(),
      resolvedAt: null,
      resolvedBy: null,
      nominationId: null
    }
  }

  validateStoryteller(manager, game, member) {
    if (!manager.isStoryteller?.(game, member.id)) {
      return manager.createError(manager.errorTypes.PERMISSION_DENIED, 'Only the Storyteller can do that.')
    }

    return manager.createSuccess()
  }
}

module.exports = NominationRequestService
