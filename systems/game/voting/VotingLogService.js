function getVotingLogForDay(game, day) {
  return (game.nominations || [])
    .filter(nomination => nomination.day === day)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .map((nomination, index) => ({
      order: index + 1,
      id: nomination.id,
      day: nomination.day,
      nominatorId: nomination.nominatorId || null,
      nomineeId: nomination.nomineeId,
      selfNomination: nomination.nominatorId === nomination.nomineeId,
      secondedBy: nomination.secondedBy || null,
      status: nomination.status,
      yesVotes: nomination.yesVotes || 0,
      threshold: nomination.threshold || 0,
      result: nomination.result || null,
      executionCandidateAfterVote: nomination.executionCandidateAfterVote || null,
      executed: nomination.executed === true,
      createdAt: nomination.createdAt || null,
      resolvedAt: nomination.resolvedAt || null,
      resolvedBy: nomination.resolvedBy || null
    }))
}

function getCurrentDayVotingLog(game) {
  return getVotingLogForDay(game, game.day || 1)
}

module.exports = {
  getCurrentDayVotingLog,
  getVotingLogForDay
}
