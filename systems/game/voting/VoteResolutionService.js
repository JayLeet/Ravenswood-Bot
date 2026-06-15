const ExecutionCandidateService = require('./ExecutionCandidateService')
const guards = require('./VotingConcurrencyGuards')

class VoteResolutionService {
  constructor(voting) {
    this.voting = voting
    this.executionCandidates = new ExecutionCandidateService()
  }

  async resolveVote(manager, guildId, member, nomineeId) {
    const controlled = manager.getStorytellerControlledPlayer(guildId, member, nomineeId)
    if (!controlled.ok) return controlled

    const { game } = controlled
    const nomination = this.voting.getLatestNomination(game, nomineeId, ['voting'])

    if (!nomination) {
      return manager.createError(manager.errorTypes.NOT_FOUND, 'No open vote found for that player')
    }

    const live = guards.assertNominationLive(
      manager,
      game,
      nomination,
      ['voting'],
      ['nominations'],
      'Voting is no longer open for that player'
    )
    if (!live.ok) return live

    const baseYesVotes = this.voting.countYesVotes(game, nomination.id)
    const baseThreshold = nomination.threshold || this.voting.getVoteThreshold(game)
    const voteContext = await manager.roleEngine.modifyVote(manager, game, nomination, {
      yesVotes: baseYesVotes,
      threshold: baseThreshold,
      executed: baseYesVotes >= baseThreshold,
      finalizingDay: false
    })
    const yesVotes = voteContext.yesVotes
    const threshold = voteContext.threshold
    const reachedMajority = voteContext.executed ?? yesVotes >= threshold
    const candidateResult = this.executionCandidates.resolveCandidate(
      game,
      nomination,
      yesVotes,
      threshold,
      reachedMajority
    )

    nomination.status = 'resolved'
    nomination.yesVotes = yesVotes
    nomination.threshold = threshold
    nomination.executed = false
    nomination.executionCandidateAfterVote = game.executionCandidate
      ? { ...game.executionCandidate }
      : null
    nomination.resolvedAt = Date.now()
    nomination.resolvedBy = member.id

    await manager.emit('VOTE_RESOLVED', {
      game,
      member,
      nomination,
      executionCandidate: game.executionCandidate || null
    })

    manager.save()

    return manager.createSuccess({
      nomination: this.voting.serializeNomination(game, nomination),
      executionCandidate: game.executionCandidate || null,
      markedForExecution: candidateResult.status === 'marked_for_execution',
      yesVotes,
      threshold,
      view: manager.serializeGame(game, { guildId }),
      publicMessage:
        `Vote resolved for <@${nomineeId}>.\n` +
        `Yes votes: ${yesVotes}/${threshold} needed.\n` +
        candidateResult.message
    })
  }

  finalizeExecutionCandidate(manager, game, member = null) {
    return this.executionCandidates.finalize(manager, game, member)
  }
}

module.exports = VoteResolutionService