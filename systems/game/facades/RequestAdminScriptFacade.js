module.exports = {
  createRequest(game, userId, type) {
    return this.requests.createRequest(game, userId, type)
  },

  getPendingRequests(guildId) {
    const game = this.get(guildId)

    if (!game) {
      return this.createError(this.errorTypes.NOT_FOUND, 'No active game')
    }

    return this.requests.getPendingRequests(game)
  },

  getPendingRequestsForStoryteller(guildId, member) {
    return this.requests.getPendingRequestsForStoryteller(this, guildId, member)
  },

  getPendingRequest(guildId, requestId) {
    const game = this.get(guildId)
    if (!game) return this.createError(this.errorTypes.NOT_FOUND, 'No active game')

    return this.requests.getPendingRequest(game, requestId)
  },

  getAvailableScripts() {
    return this.createSuccess({ scripts: this.scripts.listScripts() })
  },

  async setScript(guildId, member, scriptId) {
    return this.scriptSelection.setScript(this, guildId, member, scriptId)
  },

  createJoinRequestNotification(game, request) {
    return this.requests.createJoinRequestNotification(game, request)
  },

  createReplacementStorytellerNotification(member) {
    return this.requests.createReplacementStorytellerNotification(member)
  },

  async approveRequest(guildId, member, requestId, requestedMember) {
    return this.requests.approveRequest(this, guildId, member, requestId, requestedMember)
  },

  async rejectRequest(guildId, member, requestId) {
    return this.requests.rejectRequest(this, guildId, member, requestId)
  },

  async createGame(guildId, member, options = {}) {
    return this.requests.createGame(this, guildId, member, options)
  },

  async createTestGame(guildId, member, playerCount) {
    return this.requests.createTestGame(this, guildId, member, playerCount)
  },

  async becomeStoryteller(guildId, member) {
    return this.requests.becomeStoryteller(this, guildId, member)
  },

  async startGame(guildId, member) {
    return this.session.startGame(this, guildId, member)
  },

  async endGame(guildId, member) {
    return this.session.endGame(this, guildId, member)
  },

  openEndReveal(guildId, member) {
    return this.session.openEndReveal(this, guildId, member)
  },

  cancelEndReveal(guildId, member, revealId) {
    return this.session.cancelEndReveal(this, guildId, member, revealId)
  },

  async endGameWithWinner(guildId, member, winner, revealId = null) {
    return this.session.endGameWithWinner(this, guildId, member, winner, revealId)
  },

  async kickPlayer(guildId, storytellerMember, targetMember) {
    return this.admin.kickPlayer(this, guildId, storytellerMember, targetMember)
  },

  async adminRemoveUser(guildId, adminMember, targetMember) {
    return this.admin.removeUser(this, guildId, adminMember, targetMember)
  },

  async adminForceEnd(guildId, adminMember, reason = null) {
    return this.admin.forceEnd(this, guildId, adminMember, reason)
  },

  async join(guildId, member) {
    return this.requests.join(this, guildId, member)
  },

  async spectate(guildId, member) {
    return this.requests.spectate(this, guildId, member)
  },

  async requestGrimoireAccess(guildId, member) {
    return this.requests.requestGrimoireAccess(this, guildId, member)
  },

  async leave(guildId, member) {
    return this.requests.leave(this, guildId, member)
  }
}
