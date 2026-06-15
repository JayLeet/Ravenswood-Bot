function openManualKillReveal(manager, game, guildId, member, win, playerId) {
  const reveal = {
    id: `${Date.now()}-${member.id}`,
    requestedBy: member.id,
    requestedAt: Date.now(),
    state: game.state,
    phase: game.phase,
    day: game.day || 1,
    status: 'pending',
    forcedWinner: win.winner,
    forcedReason: win.reason,
    revealedPlayers: [],
    winner: win.winner,
    winnerRevealedAt: Date.now()
  }
  game.pendingEndReveal = reveal
  game.winner = win.winner
  game.winReason = win.reason
  manager.save()

  return manager.createSuccess({
    manualKillReveal: true,
    playerId,
    lifeState: 'dead',
    reveal,
    view: manager.serializeGame(game, { guildId }),
    winner: win.winner,
    reason: win.reason
  })
}

module.exports = {
  openManualKillReveal
}
