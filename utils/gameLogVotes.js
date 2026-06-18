const {
  formatPlainUser
} = require('./gameLogTextFormat')

function formatVotes(summary) {
  const votes = summary.votes || []
  if (!votes.length) return 'No individual votes recorded.'

  const nominationsById = new Map((summary.nominations || [])
    .filter(nomination => nomination.id)
    .map(nomination => [nomination.id, nomination]))
  const groupedVotes = groupVotesByNomination(votes)

  return groupedVotes.map(group => {
    const nomination = nominationsById.get(group.nominationId)
    return [
      formatVoteGroupHeading(summary, group, nomination),
      ...group.votes.map(vote => `${formatPlainUser(summary, vote.playerId || vote.userId)} ${formatVoteAction(vote)}`)
    ].join('\n')
  }).join('\n\n')
}

function groupVotesByNomination(votes) {
  const groups = []
  const groupsById = new Map()

  for (const vote of votes) {
    const key = vote.nominationId || `vote-${groups.length}`
    let group = groupsById.get(key)
    if (!group) {
      group = { nominationId: vote.nominationId, votes: [] }
      groupsById.set(key, group)
      groups.push(group)
    }
    group.votes.push(vote)
  }

  return groups
}

function formatVoteGroupHeading(summary, group, nomination) {
  const day = nomination?.day || group.votes.find(vote => vote.day)?.day || '?'
  if (nomination?.nomineeId) {
    return `Execution vote for ${formatPlainUser(summary, nomination.nomineeId)} (Day ${day}):`
  }
  return group.nominationId
    ? `Execution vote ${group.nominationId} (Day ${day}):`
    : `Execution vote (Day ${day}):`
}

function formatVoteAction(vote) {
  return isRaisedVote(vote) ? 'voted' : 'did not vote'
}

function isRaisedVote(vote) {
  return vote.value === true ||
    vote.vote === true ||
    vote.raised === true ||
    vote.yes === true
}

module.exports = {
  formatVotes
}
