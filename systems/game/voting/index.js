/**
 * @param {import('../../../types').GameRecord} game
 * @param {import('../../../types').UserId[]} playerIds
 * @returns {void}
 */
function normalizeVotingState(game, playerIds) {
  const allowed = new Set(playerIds)
  const allowedNominees = new Set([...playerIds, game.storytellerId].filter(Boolean))
  const nominationIds = new Set()
  game.voteClockhandSpeedMs = normalizeVoteClockhandSpeedMs(game.voteClockhandSpeedMs)

  game.nominations = (game.nominations || []).filter(nomination => {
    if (!allowedNominees.has(nomination.nomineeId)) return false
    nomination.status ??= 'seconded'
    nomination.day ??= game.day || 1
    nomination.guildId ??= game.guildId
    nomination.nominatorId ??= nomination.createdBy || null
    nomination.secondedBy ??= null
    nomination.executed ??= false
    nomination.yesVotes ??= 0
    nomination.threshold ??= getVoteThreshold(game)
    nomination.voteClockhandSpeedMs = normalizeVoteClockhandSpeedMs(nomination.voteClockhandSpeedMs || game.voteClockhandSpeedMs)
    nomination.pertinencePlayerIds = (nomination.pertinencePlayerIds || []).filter(userId => allowed.has(userId))
    nominationIds.add(nomination.id)
    return true
  })

  game.votes = (game.votes || []).filter(vote =>
    nominationIds.has(vote.nominationId) &&
    allowed.has(vote.userId)
  )

  game.nominationRequests = (game.nominationRequests || []).filter(request =>
    allowed.has(request.nominatorId) &&
    allowedNominees.has(request.nomineeId)
  )

  for (const nomination of game.nominations) {
    nomination.yesVotes = countYesVotes(game, nomination.id)
    nomination.threshold = nomination.threshold || getVoteThreshold(game)
  }

  normalizeExecutionCandidate(game, nominationIds)
}

/**
 * @param {import('../../../types').GameRecord} game
 * @returns {number}
 */
function getVoteThreshold(game) {
  return Math.max(1, Math.ceil((game.alivePlayers || []).length / 2))
}

function normalizeVoteClockhandSpeedMs(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 1000
  return Math.max(500, Math.min(3000, Math.round(numeric)))
}

function parseVoteClockhandSpeedMs(value) {
  const text = String(value ?? '').trim()
  if (!text) return null

  const numeric = Number(text)
  if (!Number.isFinite(numeric)) return null
  return normalizeVoteClockhandSpeedMs(numeric * 1000)
}

/**
 * @param {import('../../../types').GameRecord} game
 * @param {import('../../../types').NominationId} nominationId
 * @returns {number}
 */
function countYesVotes(game, nominationId) {
  return (game.votes || [])
    .filter(vote => vote.nominationId === nominationId && vote.value === true)
    .length
}

/**
 * @param {import('../../../types').GameRecord} game
 * @param {import('../../../types').UserId | null} [nomineeId]
 * @param {import('../../../types').NominationStatus[] | null} [statuses]
 * @returns {import('../../../types').Nomination | null}
 */
function getLatestNomination(game, nomineeId = null, statuses = null) {
  return [...(game.nominations || [])]
    .reverse()
    .find(nomination => {
      if (nomineeId && nomination.nomineeId !== nomineeId) return false
      if (statuses && !statuses.includes(nomination.status)) return false
      return true
    }) || null
}

/**
 * @param {import('../../../types').GameRecord} game
 * @param {import('../../../types').Nomination | null} nomination
 * @returns {import('../../../types').SerializedNomination | null}
 */
function serializeNomination(game, nomination) {
  if (!nomination) return null

  return {
    ...nomination,
    yesVotes: countYesVotes(game, nomination.id),
    threshold: nomination.threshold || getVoteThreshold(game),
    voteClockhandSpeedMs: normalizeVoteClockhandSpeedMs(nomination.voteClockhandSpeedMs || game.voteClockhandSpeedMs)
  }
}

function normalizeExecutionCandidate(game, nominationIds) {
  const candidate = game.executionCandidate
  if (!candidate) {
    game.executionCandidate = null
    return
  }

  const valid = candidate.day === (game.day || 1) &&
    nominationIds.has(candidate.nominationId) &&
    (game.nominations || []).some(nomination =>
      nomination.id === candidate.nominationId &&
      nomination.nomineeId === candidate.nomineeId
    )

  if (!valid) game.executionCandidate = null
}

module.exports = {
  countYesVotes,
  getLatestNomination,
  getVoteThreshold,
  normalizeVoteClockhandSpeedMs,
  normalizeVotingState,
  parseVoteClockhandSpeedMs,
  serializeNomination
}
