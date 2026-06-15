const {
  isClocktowerLiveMode
} = require('../../../utils/gameModes')
const {
  castNominationHandVote,
  emitVoteCounted,
  emitVoteOpened,
  getControlledVotingGame,
  getNextCountedPlayer,
  hasBeenCounted,
  toggleNominationPertinence
} = require('./SessionVotingHelpers')

module.exports = {
  evaluateWinConditions(game, options = {}) {
    return this.session.evaluateWinConditions(this, game, options)
  },

  async forceEnd(game, win, guild = null) {
    return this.session.forceEnd(this, game, win, guild)
  },

  async setPhase(game, nextPhase, guild = null, options = {}) {
    return this.session.setPhase(this, game, nextPhase, guild, options)
  },

  async nextPhase(game, guild = null) {
    return this.session.nextPhase(this, game, guild)
  },

  async advancePhase(guildId, member) {
    return this.session.advancePhase(this, guildId, member)
  },

  revealGrimPlayer(guildId, member, playerId, revealId) {
    return this.session.revealGrimPlayer(this, guildId, member, playerId, revealId)
  },

  async createNomination(guildId, member, nomineeId, options = {}) {
    const blocked = blockClocktowerOnlineVoting(this, guildId)
    if (blocked) return blocked
    return this.voting.createNomination(this, guildId, member, nomineeId, options)
  },

  async forceStorytellerNomination(guildId, member, nominatorId, nomineeId) {
    const blocked = blockClocktowerOnlineVoting(this, guildId)
    if (blocked) return blocked
    const approved = await this.voting.nominationRequests.approveMatchingRequest(
      this,
      guildId,
      member,
      nominatorId,
      nomineeId
    )
    if (approved) return approved

    return this.voting.createNomination(this, guildId, member, nomineeId, {
      forceStorytellerNomination: true,
      manualStorytellerNomination: true,
      nominatorId
    })
  },

  createNominationRequest(guildId, member, nomineeId) {
    const blocked = blockClocktowerOnlineVoting(this, guildId)
    if (blocked) return blocked
    return this.voting.createNominationRequest(this, guildId, member, nomineeId)
  },

  approveNominationRequest(guildId, member, requestId) {
    const blocked = blockClocktowerOnlineVoting(this, guildId)
    if (blocked) return blocked
    return this.voting.approveNominationRequest(this, guildId, member, requestId)
  },

  rejectNominationRequest(guildId, member, requestId) {
    return this.voting.rejectNominationRequest(this, guildId, member, requestId)
  },

  cancelNominationRequest(guildId, member, requestId) {
    return this.voting.cancelNominationRequest(this, guildId, member, requestId)
  },

  rescindNominationRequest(guildId, member, requestId) {
    return this.voting.rescindNominationRequest(this, guildId, member, requestId)
  },

  rescindOwnNominationRequest(guildId, member) {
    return this.voting.rescindOwnNominationRequest(this, guildId, member)
  },

  getPendingNominationRequests(game) {
    return this.voting.getPendingNominationRequests(game)
  },

  cancelNomination(guildId, member, nominationId) {
    const blocked = blockClocktowerOnlineVoting(this, guildId)
    if (blocked) return blocked
    return this.voting.cancelNomination(this, guildId, member, nominationId)
  },

  cancelCurrentVote(guildId, member) {
    const blocked = blockClocktowerOnlineVoting(this, guildId)
    if (blocked) return blocked
    return this.voting.cancelCurrentVote(this, guildId, member)
  },

  clearExecutionCandidate(guildId, member) {
    const blocked = blockClocktowerOnlineVoting(this, guildId)
    if (blocked) return blocked
    return this.voting.clearExecutionCandidate(this, guildId, member)
  },

  markExecutionCandidate(guildId, member, nomineeId, options = {}) {
    const blocked = blockClocktowerOnlineVoting(this, guildId)
    if (blocked) return blocked
    return this.voting.markExecutionCandidate(this, guildId, member, nomineeId, options)
  },

  setCurrentVoteThreshold(guildId, member, threshold) {
    const blocked = blockClocktowerOnlineVoting(this, guildId)
    if (blocked) return blocked
    return this.voting.setCurrentVoteThreshold(this, guildId, member, threshold)
  },

  setVoteClockhandSpeed(guildId, member, seconds) {
    const blocked = blockClocktowerOnlineVoting(this, guildId)
    if (blocked) return blocked
    return this.voting.setVoteClockhandSpeed(this, guildId, member, seconds)
  },

  async countNextVote(guildId, member) {
    const blocked = blockClocktowerOnlineVoting(this, guildId)
    if (blocked) return blocked
    const controlled = getControlledVotingGame(this, guildId, member)
    if (!controlled.ok) return controlled
    const { game } = controlled
    const nomination = this.voting.getLatestNomination(game, null, ['voting'])
    if (!nomination) return this.createError(this.errorTypes.NOT_FOUND, 'No running vote found')

    const nextPlayerId = getNextCountedPlayer(game, nomination)
    if (!nextPlayerId) {
      return this.createError(this.errorTypes.INVALID_STATE, 'Every eligible voter has already been counted')
    }

    nomination.countedVotePlayerIds ??= []
    nomination.countedVotePlayerIds.push(nextPlayerId)
    nomination.yesVotes = this.voting.countYesVotes(game, nomination.id)
    emitVoteCounted(this, game, member, nomination, nextPlayerId)

    if (getNextCountedPlayer(game, nomination)) {
      this.save()
      return this.createSuccess({
        nomination: this.voting.serializeNomination(game, nomination),
        publicMessage: `<@${nextPlayerId}> has been counted.`,
        view: this.serializeGame(game, { guildId })
      })
    }

    const resolved = await this.voting.resolveVote(this, guildId, member, nomination.nomineeId)
    if (!resolved.ok) return resolved

    return this.createSuccess({
      ...resolved,
      publicMessage: [`<@${nextPlayerId}> has been counted.`, resolved.publicMessage].join('\n')
    })
  },

  resetVoteCount(guildId, member) {
    const blocked = blockClocktowerOnlineVoting(this, guildId)
    if (blocked) return blocked
    const controlled = getControlledVotingGame(this, guildId, member)
    if (!controlled.ok) return controlled
    const { game } = controlled
    const nomination = this.voting.getLatestNomination(game, null, ['voting'])
    if (!nomination) return this.createError(this.errorTypes.NOT_FOUND, 'No running vote found')

    nomination.countedVotePlayerIds = []
    nomination.yesVotes = this.voting.countYesVotes(game, nomination.id)
    emitVoteOpened(this, game, member, nomination)
    this.save()

    return this.createSuccess({
      nomination: this.voting.serializeNomination(game, nomination),
      publicMessage: 'The vote count was restarted.',
      view: this.serializeGame(game, { guildId })
    })
  },

  async secondNomination(guildId, member, nominationId) {
    const blocked = blockClocktowerOnlineVoting(this, guildId)
    if (blocked) return blocked
    return this.voting.secondNomination(this, guildId, member, nominationId)
  },

  async openVote(guildId, member, nomineeId) {
    const blocked = blockClocktowerOnlineVoting(this, guildId)
    if (blocked) return blocked
    const game = this.get(guildId)
    const nomination = this.voting.getLatestNomination(game || {}, nomineeId, ['seconded'])
    const existingVotes = nomination
      ? (game.votes || []).filter(vote => vote.nominationId === nomination.id)
      : []
    const existingThreshold = nomination?.threshold

    const result = await this.voting.openVote(this, guildId, member, nomineeId)
    if (!result.ok || !nomination) return result

    game.votes = [
      ...(game.votes || []).filter(vote => vote.nominationId !== nomination.id),
      ...existingVotes
    ]
    if (Number.isInteger(existingThreshold)) nomination.threshold = existingThreshold
    delete nomination.voteCancelledAt
    delete nomination.voteCancelledBy
    nomination.pertinencePlayerIds = []
    nomination.countedVotePlayerIds = []
    nomination.yesVotes = this.voting.countYesVotes(game, nomination.id)
    this.save()

    return this.createSuccess({
      nomination: this.voting.serializeNomination(game, nomination),
      view: this.serializeGame(game, { guildId })
    })
  },

  async castVote(guildId, member, nominationId, value) {
    const blocked = blockClocktowerOnlineVoting(this, guildId)
    if (blocked) return blocked
    const game = this.get(guildId)
    const nomination = (game?.nominations || []).find(item => item.id === nominationId)

    if (nomination?.status === 'seconded') {
      return castNominationHandVote(this, game, guildId, member, nomination, value)
    }

    if (nomination?.status === 'voting' && hasBeenCounted(nomination, member.id)) {
      return this.createError(this.errorTypes.INVALID_STATE, 'Your vote has already been counted')
    }

    return this.voting.castVote(this, guildId, member, nominationId, value)
  },

  async toggleNominationPertinence(guildId, member, nominationId) {
    const blocked = blockClocktowerOnlineVoting(this, guildId)
    if (blocked) return blocked
    const game = this.get(guildId)
    const nomination = (game?.nominations || []).find(item => item.id === nominationId)
    if (!nomination) return this.createError(this.errorTypes.NOT_FOUND, 'Nomination not found')
    return toggleNominationPertinence(this, game, guildId, member, nomination)
  },

  async resolveVote(guildId, member, nomineeId) {
    const blocked = blockClocktowerOnlineVoting(this, guildId)
    if (blocked) return blocked
    return this.voting.resolveVote(this, guildId, member, nomineeId)
  },

  async finalizeExecutionCandidate(game, member = null) {
    if (isClocktowerLiveMode(game)) return this.createSuccess()
    return this.voting.finalizeExecutionCandidate(this, game, member)
  },

  setNominationMessage(guildId, nominationId, channelId, messageId) {
    return this.voting.setNominationMessage(this, guildId, nominationId, channelId, messageId)
  }
}

function blockClocktowerOnlineVoting(manager, guildId) {
  const game = manager.get(guildId)
  if (!isClocktowerLiveMode(game)) return null
  return manager.createError(
    manager.errorTypes.INVALID_STATE,
    'Nominations and voting are disabled in Clocktower.live mode.'
  )
}

module.exports.blockClocktowerOnlineVoting = blockClocktowerOnlineVoting
