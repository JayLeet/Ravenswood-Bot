const END_REVEAL_WINNERS = new Set(['good', 'evil'])

function normalizePendingEndReveal(game, playerIds) {
  if (!game.pendingEndReveal) return

  const reveal = game.pendingEndReveal
  if (!reveal.id) {
    game.pendingEndReveal = null
    return
  }

  reveal.status ??= 'pending'
  if (reveal.status !== 'pending') {
    game.pendingEndReveal = null
    return
  }

  const allowed = new Set(playerIds)
  reveal.revealedPlayers = [...new Set(reveal.revealedPlayers || [])]
    .filter(userId => allowed.has(userId))
  reveal.day = Number(reveal.day) || game.day || 1
  reveal.phase ||= game.phase
  reveal.state ||= game.state
  reveal.skipPlayerReveal = reveal.skipPlayerReveal === true
  reveal.forcedWinner = normalizeEndRevealWinner(reveal.forcedWinner)
  reveal.winner = normalizeEndRevealWinner(reveal.winner)
  if (reveal.requestedBy && !game.users?.[reveal.requestedBy]) reveal.requestedBy = null
  if (reveal.requestedAt !== undefined) reveal.requestedAt = Number(reveal.requestedAt) || 0
}

function normalizeEndRevealWinner(winner) {
  return END_REVEAL_WINNERS.has(winner) ? winner : null
}

module.exports = {
  normalizePendingEndReveal
}
