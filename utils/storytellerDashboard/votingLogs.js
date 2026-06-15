function formatVotingLogForDay(day, entries, playerLabels = {}) {
  if (!entries.length) return `Day ${day}\nNo nominations recorded.`

  return [
    `Day ${day}`,
    ...entries.map(entry => formatVotingLogEntry(entry, playerLabels))
  ].join('\n')
}

function formatVotingLogEntry(entry, playerLabels = {}) {
  const nominator = formatPlayer(entry.nominatorId, playerLabels)
  const nominee = formatPlayer(entry.nomineeId, playerLabels)
  const self = entry.selfNomination ? ' self-nomination' : ''
  const second = entry.secondedBy
    ? ` seconded by ${formatPlayer(entry.secondedBy, playerLabels)}`
    : ' not seconded'
  const votes = `${entry.yesVotes}/${entry.threshold || '?'} votes`

  return `${entry.order}. ${nominator} nominated ${nominee}${self} - ${votes} - ${formatVotingLogResult(entry)} -${second}`
}

function formatVotingLogResult(entry) {
  if (entry.executed) return 'executed at end of day'
  if (entry.result === 'marked_for_execution') return 'marked for execution'
  if (entry.result === 'tied_execution_candidate') return 'tied current count, no one marked'
  if (entry.result === 'not_enough_to_replace') return 'did not beat current count'
  if (entry.result === 'no_majority') return 'no majority'
  if (entry.status === 'voting') return 'vote open'
  if (entry.status === 'seconded') return 'ready for vote'
  if (entry.status === 'pending_second') return 'waiting for second'
  return entry.result || entry.status || 'unknown'
}

function formatPlayer(userId, playerLabels = {}) {
  if (!userId) return 'Unknown'
  return playerLabels[userId] || `<@${userId}>`
}

module.exports = {
  formatVotingLogEntry,
  formatVotingLogForDay,
  formatVotingLogResult
}
