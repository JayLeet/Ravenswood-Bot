const votingEngine = require('./index')
const NominationRequestService = require('./NominationRequestService')
const NominationService = require('./NominationService')
const VoteResolutionService = require('./VoteResolutionService')
const VotingControlService = require('./VotingControlService')
const votingLogs = require('./VotingLogService')
const VotingRoundService = require('./VotingRoundService')

class VotingService {
  constructor() {
    this.controls = new VotingControlService(this)
    this.nominations = new NominationService(this)
    this.nominationRequests = new NominationRequestService(this)
    this.resolution = new VoteResolutionService(this)
    this.rounds = new VotingRoundService(this)
  }

  normalizeVotingState(game, playerIds) {
    return votingEngine.normalizeVotingState(game, playerIds)
  }

  getVoteThreshold(game) {
    return votingEngine.getVoteThreshold(game)
  }

  countYesVotes(game, nominationId) {
    return votingEngine.countYesVotes(game, nominationId)
  }

  normalizeVoteClockhandSpeedMs(value) {
    return votingEngine.normalizeVoteClockhandSpeedMs(value)
  }

  parseVoteClockhandSpeedMs(value) {
    return votingEngine.parseVoteClockhandSpeedMs(value)
  }

  getLatestNomination(game, nomineeId = null, statuses = null) {
    return votingEngine.getLatestNomination(game, nomineeId, statuses)
  }

  serializeNomination(game, nomination) {
    return votingEngine.serializeNomination(game, nomination)
  }

  getVotingLogForDay(game, day) {
    return votingLogs.getVotingLogForDay(game, day)
  }

  getCurrentDayVotingLog(game) {
    return votingLogs.getCurrentDayVotingLog(game)
  }

  async createNomination(manager, guildId, member, nomineeId, options = {}) {
    return this.nominations.createNomination(manager, guildId, member, nomineeId, options)
  }

  createNominationRequest(manager, guildId, member, nomineeId) {
    return this.nominationRequests.createRequest(manager, guildId, member, nomineeId)
  }

  approveNominationRequest(manager, guildId, member, requestId) {
    return this.nominationRequests.approveRequest(manager, guildId, member, requestId)
  }

  rejectNominationRequest(manager, guildId, member, requestId) {
    return this.nominationRequests.rejectRequest(manager, guildId, member, requestId)
  }

  cancelNominationRequest(manager, guildId, member, requestId) {
    return this.nominationRequests.cancelRequest(manager, guildId, member, requestId)
  }

  rescindNominationRequest(manager, guildId, member, requestId) {
    return this.nominationRequests.rescindRequest(manager, guildId, member, requestId)
  }

  rescindOwnNominationRequest(manager, guildId, member) {
    return this.nominationRequests.rescindOwnRequest(manager, guildId, member)
  }

  getPendingNominationRequests(game) {
    return this.nominationRequests.getPendingRequests(game)
  }

  cancelNomination(manager, guildId, member, nominationId) {
    return this.controls.cancelNomination(manager, guildId, member, nominationId)
  }

  cancelCurrentVote(manager, guildId, member) {
    return this.controls.cancelCurrentVote(manager, guildId, member)
  }

  clearExecutionCandidate(manager, guildId, member) {
    return this.controls.clearExecutionCandidate(manager, guildId, member)
  }

  markExecutionCandidate(manager, guildId, member, nomineeId, options = {}) {
    return this.controls.markExecutionCandidate(manager, guildId, member, nomineeId, options)
  }

  setCurrentVoteThreshold(manager, guildId, member, threshold) {
    return this.controls.setCurrentVoteThreshold(manager, guildId, member, threshold)
  }

  setVoteClockhandSpeed(manager, guildId, member, seconds) {
    return this.controls.setVoteClockhandSpeed(manager, guildId, member, seconds)
  }

  async secondNomination(manager, guildId, member, nominationId) {
    return this.rounds.secondNomination(manager, guildId, member, nominationId)
  }

  async openVote(manager, guildId, member, nomineeId) {
    return this.rounds.openVote(manager, guildId, member, nomineeId)
  }

  async castVote(manager, guildId, member, nominationId, value) {
    return this.rounds.castVote(manager, guildId, member, nominationId, value)
  }

  async resolveVote(manager, guildId, member, nomineeId) {
    return this.resolution.resolveVote(manager, guildId, member, nomineeId)
  }

  async finalizeExecutionCandidate(manager, game, member = null) {
    return this.resolution.finalizeExecutionCandidate(manager, game, member)
  }

  setNominationMessage(manager, guildId, nominationId, channelId, messageId) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(manager.errorTypes.NOT_FOUND, 'No game')

    const nomination = (game.nominations || []).find(nomination => nomination.id === nominationId)
    if (!nomination) return manager.createError(manager.errorTypes.NOT_FOUND, 'Nomination not found')

    nomination.channelId = channelId
    nomination.messageId = messageId
    manager.save()

    return manager.createSuccess({
      nomination: this.serializeNomination(game, nomination)
    })
  }
}

module.exports = VotingService
