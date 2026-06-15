function createResolvedVoteFields(nomination, view) {
  return [
    {
      name: 'Outcome',
      value: formatResolvedVoteOutcome(nomination, view),
      inline: false
    }
  ]
}

function formatResolvedVoteOutcome(nomination, view) {
  const nominee = `<@${nomination.nomineeId}>`
  return [
    `${nominee}: ${formatNominationResultText(nomination, view)}`,
    `Raised hands: ${nomination.yesVotes || 0}/${nomination.threshold || Math.ceil((view.counts?.alive || 0) / 2)} needed.`
  ].join('\n')
}

function formatNominationResultText(nomination, view) {
  if (nomination.executed) return 'executed.'

  if (nomination.result === 'marked_for_execution') {
    return isCurrentExecutionCandidate(nomination, view)
      ? 'marked for execution.'
      : 'no longer marked for execution.'
  }

  if (nomination.result === 'tied_execution_candidate') {
    return 'tied the current count. No one is marked for execution.'
  }

  if (nomination.result === 'not_enough_to_replace') {
    return 'did not beat the current execution count.'
  }

  if (nomination.result === 'no_majority') {
    return 'not marked for execution.'
  }

  return 'not marked for execution.'
}

function isCurrentExecutionCandidate(nomination, view) {
  return view?.engine?.executionCandidate?.nominationId === nomination.id
}

module.exports = {
  createResolvedVoteFields,
  formatNominationResultText,
  formatResolvedVoteOutcome,
  isCurrentExecutionCandidate
}
