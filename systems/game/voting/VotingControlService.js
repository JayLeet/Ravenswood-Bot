const {
  createBotLogger
} = require('../../../utils/logger')

const log = createBotLogger({ subsystem: 'VotingControlService' })

class VotingControlService {
  constructor(voting) {
    this.voting = voting
  }

  cancelNomination(manager, guildId, member, nominationId) {
    const controlled = this.getControlledGame(manager, guildId, member)
    if (!controlled.ok) return controlled

    const { game } = controlled
    const nomination = this.findNomination(game, nominationId)
    if (!nomination) return manager.createError(manager.errorTypes.NOT_FOUND, 'Nomination not found')

    if (nomination.status === 'resolved' || nomination.status === 'cancelled') {
      return manager.createError(manager.errorTypes.INVALID_STATE, 'That nomination is already resolved')
    }

    nomination.status = 'cancelled'
    nomination.result = 'cancelled'
    nomination.resolvedAt = Date.now()
    nomination.resolvedBy = member.id

    if (game.executionCandidate?.nominationId === nomination.id) {
      game.executionCandidate = null
    }

    game.votes = (game.votes || []).filter(vote => vote.nominationId !== nomination.id)
    emitVotingEvent(manager, 'emit-nomination-cancelled', 'NOMINATION_CANCELLED', { game, member, nomination }, {
      guildId,
      memberId: member.id,
      nominationId: nomination.id
    })
    manager.save()

    return manager.createSuccess({
      nomination: this.voting.serializeNomination(game, nomination),
      publicMessage: `The nomination of <@${nomination.nomineeId}> was cancelled.`,
      view: manager.serializeGame(game, { guildId })
    })
  }

  cancelCurrentVote(manager, guildId, member) {
    const controlled = this.getControlledGame(manager, guildId, member)
    if (!controlled.ok) return controlled

    const { game } = controlled
    const nomination = this.voting.getLatestNomination(game, null, ['voting'])
    if (!nomination) return manager.createError(manager.errorTypes.NOT_FOUND, 'No open vote found')

    nomination.status = 'seconded'
    nomination.voteCancelledAt = Date.now()
    nomination.voteCancelledBy = member.id
    nomination.yesVotes = 0
    game.votes = (game.votes || []).filter(vote => vote.nominationId !== nomination.id)
    emitVotingEvent(manager, 'emit-vote-paused', 'VOTE_PAUSED', { game, member, nomination }, {
      guildId,
      memberId: member.id,
      nominationId: nomination.id
    })
    manager.save()

    return manager.createSuccess({
      nomination: this.voting.serializeNomination(game, nomination),
      publicMessage: `The vote for <@${nomination.nomineeId}> was paused.`,
      view: manager.serializeGame(game, { guildId })
    })
  }

  markExecutionCandidate(manager, guildId, member, nomineeId, options = {}) {
    const controlled = this.getControlledGame(manager, guildId, member)
    if (!controlled.ok) return controlled

    const { game } = controlled
    const nominee = this.validateNominee(manager, game, nomineeId)
    if (!nominee.ok) return nominee

    const nomination = options.nominationId
      ? this.findNomination(game, options.nominationId)
      : null
    const yesVotes = Number.isInteger(options.yesVotes) ? options.yesVotes : 0
    const threshold = Number.isInteger(options.threshold)
      ? options.threshold
      : this.voting.getVoteThreshold(game)

    game.executionCandidate = {
      nomineeId,
      nominationId: nomination?.id || null,
      yesVotes,
      threshold,
      day: game.day || 1,
      manual: true,
      markedBy: member.id,
      markedAt: Date.now()
    }

    if (nomination) nomination.result = 'marked_for_execution'
    emitVotingEvent(manager, 'emit-execution-candidate-marked', 'EXECUTION_CANDIDATE_CHANGED', {
      game,
      member,
      executionCandidate: game.executionCandidate
    }, {
      guildId,
      memberId: member.id,
      nomineeId,
      nominationId: nomination?.id || null
    })
    manager.save()

    return manager.createSuccess({
      executionCandidate: game.executionCandidate,
      publicMessage: `<@${nomineeId}> was manually marked for execution.`,
      view: manager.serializeGame(game, { guildId })
    })
  }

  clearExecutionCandidate(manager, guildId, member) {
    const controlled = this.getControlledGame(manager, guildId, member)
    if (!controlled.ok) return controlled

    const { game } = controlled
    game.executionCandidate = null
    emitVotingEvent(manager, 'emit-execution-candidate-cleared', 'EXECUTION_CANDIDATE_CHANGED', {
      game,
      member,
      executionCandidate: null
    }, {
      guildId,
      memberId: member.id
    })
    manager.save()

    return manager.createSuccess({
      executionCandidate: null,
      publicMessage: 'The execution candidate was cleared.',
      view: manager.serializeGame(game, { guildId })
    })
  }

  setCurrentVoteThreshold(manager, guildId, member, threshold) {
    const controlled = this.getControlledGame(manager, guildId, member)
    if (!controlled.ok) return controlled

    const value = Number(threshold)
    if (!Number.isInteger(value) || value < 1) {
      return manager.createError(manager.errorTypes.INVALID_STATE, 'Vote threshold must be a positive whole number')
    }

    const { game } = controlled
    const nomination = this.voting.getLatestNomination(game, null, ['voting', 'seconded'])
    if (!nomination) return manager.createError(manager.errorTypes.NOT_FOUND, 'No current vote or seconded nomination found')

    nomination.threshold = value
    manager.save()

    return manager.createSuccess({
      nomination: this.voting.serializeNomination(game, nomination),
      publicMessage: `The vote threshold for <@${nomination.nomineeId}> is now ${value}.`,
      view: manager.serializeGame(game, { guildId })
    })
  }

  setVoteClockhandSpeed(manager, guildId, member, seconds) {
    const controlled = this.getControlledGame(manager, guildId, member)
    if (!controlled.ok) return controlled

    const speedMs = this.voting.parseVoteClockhandSpeedMs(seconds)
    if (!speedMs) {
      return manager.createError(manager.errorTypes.INVALID_STATE, 'Clockhand speed must be a number between 0.5 and 3 seconds')
    }

    const { game } = controlled
    game.voteClockhandSpeedMs = speedMs

    const nomination = this.voting.getLatestNomination(game, null, ['voting', 'seconded'])
    if (nomination) nomination.voteClockhandSpeedMs = speedMs
    manager.save()

    return manager.createSuccess({
      nomination: nomination ? this.voting.serializeNomination(game, nomination) : null,
      publicMessage: null,
      speedMs,
      view: manager.serializeGame(game, { guildId })
    })
  }

  getControlledGame(manager, guildId, member) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(manager.errorTypes.NOT_FOUND, 'No game')

    if (!manager.isStoryteller(game, member.id)) {
      return manager.createError(manager.errorTypes.PERMISSION_DENIED, 'Only the Storyteller can do that')
    }

    if (game.phase !== 'nominations') {
      return manager.createError(manager.errorTypes.INVALID_STATE, 'Voting controls are only available during nominations')
    }

    return manager.createSuccess({ game })
  }

  findNomination(game, nominationId) {
    return (game.nominations || []).find(nomination => nomination.id === nominationId) || null
  }

  validateNominee(manager, game, nomineeId) {
    if (manager.getRole(game, nomineeId) !== 'player') {
      return manager.createError(manager.errorTypes.INVALID_STATE, 'Only players can be marked for execution')
    }

    if (!(game.alivePlayers || []).includes(nomineeId)) {
      return manager.createError(manager.errorTypes.INVALID_STATE, 'Only living players can be marked for execution')
    }

    return manager.createSuccess()
  }
}

function emitVotingEvent(manager, action, event, payload, context) {
  const emitted = manager.emit(event, payload)
  if (typeof emitted?.catch === 'function') {
    emitted.catch(err => log.recoverable(action, err, context))
  }
  return emitted
}

module.exports = VotingControlService
