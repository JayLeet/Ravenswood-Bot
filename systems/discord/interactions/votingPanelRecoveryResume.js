const {
  getNextClockhandPlayerId
} = require('../../../utils/voteClockhand')

function createRecoveredVoteCountResumer({ scheduleVoteCountTick }) {
  return function resumeRecoveredVoteCounts(guildId, view) {
    const storytellerId = view?.storytellerId
    if (!storytellerId) return 0

    let resumed = 0
    for (const nomination of view?.engine?.nominations || []) {
      if (nomination.status !== 'voting') continue
      if (!hasRemainingVoteCount(view, nomination)) continue

      scheduleVoteCountTick(guildId, nomination.id, { id: storytellerId }, nomination.voteClockhandSpeedMs)
      resumed += 1
    }
    return resumed
  }
}

function hasRemainingVoteCount(view, nomination) {
  return !!getNextClockhandPlayerId({
    alivePlayerIds: view?.users?.alivePlayers || [],
    deadPlayerIds: view?.users?.deadPlayers || [],
    deadVotes: view?.engine?.deadVotes || {},
    nominationId: nomination?.id,
    playerIds: view?.users?.players || [],
    startPlayerId: nomination?.nomineeId,
    votes: view?.engine?.votes || []
  }, nomination?.countedVotePlayerIds || [])
}

module.exports = {
  createRecoveredVoteCountResumer,
  hasRemainingVoteCount
}
