const phases = require('../phases')
const roles = require('../roles')

module.exports = {
  get(guildId) {
    const game = this.gameManager.get(guildId)
    if (!game) return null

    if (this.isStaleEmptyGame(game)) {
      this.gameManager.games.delete(guildId)
      this.save()
      return null
    }

    game.users ??= {}
    game.requests ??= []
    game.messages ??= []
    game.state ??= 'lobby'
    game.phase ??= null
    game.phaseStartedAt ??= game.startedAt || game.createdAt || Date.now()
    game.phaseHistory ??= []
    game.maxPlayers ??= 15
    game.winner ??= null
    game.winReason ??= null
    this.normalizeEngineState(game)

    return game
  },

  normalizeEngineState(game) {
    this.stateNormalizer.normalize(this, game)
  },

  normalizePhase(game) {
    return phases.normalizePhase(game)
  },

  normalizePlayerList(userIds, playerIds) {
    return this.stateNormalizer.normalizePlayerList(userIds, playerIds)
  },

  resolveScript(value) {
    return this.scripts.getScript(value) || this.scripts.getDefaultScript()
  },

  createDefaultRoleCategories(scriptId = this.scripts.defaultScriptId) {
    return roles.createDefaultRoleCategories(scriptId)
  },

  removeRolesOutsideScript(game) {
    roles.removeRolesOutsideScript(game)
  },

  countNightActions(game) {
    return this.nightActions.countByStatus(game)
  },

  normalizeVotingState(game, playerIds) {
    this.voting.normalizeVotingState(game, playerIds)
  },

  getVoteThreshold(game) {
    return this.voting.getVoteThreshold(game)
  },

  countYesVotes(game, nominationId) {
    return this.voting.countYesVotes(game, nominationId)
  },

  getLatestNomination(game, nomineeId = null, statuses = null) {
    return this.voting.getLatestNomination(game, nomineeId, statuses)
  },

  serializeNomination(game, nomination) {
    return this.voting.serializeNomination(game, nomination)
  },

  getVotingLogForDay(game, day) {
    return this.voting.getVotingLogForDay(game, day)
  },

  getCurrentDayVotingLog(game) {
    return this.voting.getCurrentDayVotingLog(game)
  },

  normalizeDeadVotes(game, playerIds) {
    this.stateNormalizer.normalizeDeadVotes(game, playerIds)
  },

  normalizeGrimReminders(game, playerIds) {
    this.reminders.normalizeReminders(game, playerIds, type => this.formatScriptRole(type))
  },

  normalizeGrimReminderType(type) {
    return this.reminders.normalizeType(type)
  },

  removeEngineDataForMissingPlayers(game, playerIds) {
    this.stateNormalizer.removeEngineDataForMissingPlayers(this, game, playerIds)
  },

  serializeGame(game, context = {}) {
    return this.serializer.serializeGame(game, context)
  },

  getGameView(guildId) {
    const game = this.get(guildId)
    if (!game) return null

    return this.serializeGame(game, { guildId })
  },

  getRole(game, userId) {
    return this.playerState.getRole(game, userId)
  },

  getPlayerIds(game) {
    return this.playerState.getPlayerIds(game)
  },

  isFakePlayer(game, userId) {
    return this.playerState.isFakePlayer(game, userId)
  },

  getDisplayName(game, userId) {
    return this.playerState.getDisplayName(game, userId)
  },

  isStoryteller(game, userId) {
    return this.playerState.isStoryteller(game, userId)
  },

  setRole(game, userId, role) {
    this.playerState.setRole(game, userId, role)
  },

  removeUser(game, userId) {
    this.playerState.removeUser(game, userId)
  },

  addAlivePlayer(game, userId) {
    this.playerState.addAlivePlayer(game, userId)
  },

  addDeadPlayer(game, userId) {
    this.playerState.addDeadPlayer(game, userId)
  },

  removePlayerFromEngine(game, userId) {
    this.playerState.removePlayerFromEngine(game, userId)
  },

  formatPhase(game) {
    return phases.formatPhase(game)
  },

  removePendingRequestsForUser(game, userId) {
    this.requests.removePendingRequestsForUser(game, userId)
  },

  isStaleEmptyGame(game) {
    return !game.storytellerId && Object.keys(game.users || {}).length === 0
  },

  pruneStaleEmptyGames() {
    let pruned = false

    for (const [guildId, game] of this.gameManager.games.entries()) {
      if (!this.isStaleEmptyGame(game)) continue

      this.gameManager.games.delete(guildId)
      pruned = true
    }

    if (pruned) this.save()
  },

  hasNoPlayers(game) {
    return this.playerState.hasNoPlayers(game)
  },

  trackMessage(guildId, message) {
    const game = this.get(guildId)
    if (!game || !message?.id || !message?.channelId) return

    game.messages ??= []

    const exists = game.messages.some(ref =>
      ref.channelId === message.channelId &&
      ref.messageId === message.id
    )

    if (exists) return

    game.messages.push({
      channelId: message.channelId,
      messageId: message.id
    })

    this.save()
  },

  canStepInAsStoryteller(game, userId) {
    return this.playerState.canStepInAsStoryteller(game, userId)
  }
}
