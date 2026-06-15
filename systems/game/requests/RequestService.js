const GameCreationService = require('./GameCreationService')
const MembershipService = require('./MembershipService')
const RequestApprovalService = require('./RequestApprovalService')
const RequestNotificationService = require('./RequestNotificationService')

class RequestService {
  constructor({ errorTypes }) {
    this.errorTypes = errorTypes
    this.approvals = new RequestApprovalService({ errorTypes })
    this.games = new GameCreationService({ errorTypes })
    this.membership = new MembershipService({ errorTypes })
    this.notifications = new RequestNotificationService()
  }

  createError(type, message, meta = {}) {
    return { ok: false, error: { type, message, meta } }
  }

  createSuccess(data = {}) {
    return { ok: true, ...data }
  }

  removePendingRequestsForUser(game, userId) {
    game.requests = (game.requests || []).filter(req =>
      req.userId !== userId || req.status !== 'pending'
    )
  }

  createRequest(game, userId, type) {
    game.requests ??= []

    if (!['join', 'spectate', 'grimoire'].includes(type)) {
      return this.createError(this.errorTypes.INVALID_STATE, 'Unknown request type')
    }

    const existingOfType = game.requests.find(req =>
      req.userId === userId &&
      req.type === type &&
      req.status === 'pending'
    )

    if (existingOfType) {
      return this.createError(
        this.errorTypes.INVALID_STATE,
        `You already have a pending ${type} request`
      )
    }

    const existingForUser = game.requests.find(req =>
      req.userId === userId &&
      req.status === 'pending'
    )

    if (existingForUser) {
      return this.createError(
        this.errorTypes.INVALID_STATE,
        'You already have a pending request'
      )
    }

    const request = {
      id: `${Date.now()}-${userId}`,
      userId,
      type,
      status: 'pending',
      createdAt: Date.now()
    }

    game.requests.push(request)

    return this.createSuccess({ request })
  }

  getPendingRequests(game) {
    game.requests ??= []

    return this.createSuccess({
      requests: game.requests.filter(req => req.status === 'pending')
    })
  }

  getPendingRequest(game, requestId) {
    const pending = this.getPendingRequests(game)
    if (!pending.ok) return pending

    const request = pending.requests.find(req => req.id === requestId)

    if (!request) {
      return this.createError(this.errorTypes.NOT_FOUND, 'Pending request not found')
    }

    return this.createSuccess({ request })
  }

  markApproved(game, request, resolvedBy) {
    request.status = 'approved'
    request.resolvedAt = Date.now()
    request.resolvedBy = resolvedBy
    this.removePendingRequestsForUser(game, request.userId)
  }

  rejectPendingRequest(game, requestId, resolvedBy) {
    game.requests ??= []

    const request = game.requests.find(req => req.id === requestId)

    if (!request || request.status !== 'pending') {
      return this.createError(this.errorTypes.NOT_FOUND, 'Pending request not found')
    }

    request.status = 'rejected'
    request.resolvedAt = Date.now()
    request.resolvedBy = resolvedBy

    return this.createSuccess({ request })
  }

  getPendingRequestsForStoryteller(manager, guildId, member) {
    return this.approvals.getPendingRequestsForStoryteller(this, manager, guildId, member)
  }

  async approveRequest(manager, guildId, member, requestId, requestedMember) {
    return this.approvals.approveRequest(
      this,
      manager,
      guildId,
      member,
      requestId,
      requestedMember
    )
  }

  async rejectRequest(manager, guildId, member, requestId) {
    return this.approvals.rejectRequest(this, manager, guildId, member, requestId)
  }

  async createGame(manager, guildId, member, options = {}) {
    return this.games.createGame(this, manager, guildId, member, options)
  }

  async createTestGame(manager, guildId, member, playerCount) {
    return this.games.createTestGame(this, manager, guildId, member, playerCount)
  }

  async becomeStoryteller(manager, guildId, member) {
    return this.games.becomeStoryteller(this, manager, guildId, member)
  }

  async join(manager, guildId, member) {
    return this.membership.join(this, manager, guildId, member)
  }

  async spectate(manager, guildId, member) {
    return this.membership.spectate(this, manager, guildId, member)
  }

  async requestGrimoireAccess(manager, guildId, member) {
    return this.membership.requestGrimoireAccess(this, manager, guildId, member)
  }

  async leave(manager, guildId, member) {
    return this.membership.leave(this, manager, guildId, member)
  }

  createJoinRequestNotification(game, request) {
    return this.notifications.createJoinRequestNotification(game, request)
  }

  createReplacementStorytellerNotification(member) {
    return this.notifications.createReplacementStorytellerNotification(member)
  }
}

module.exports = RequestService
