class SessionHistoryService {
  constructor({
    deletePendingGameSummary = null,
    savePendingGameSummary = null,
    updateAchievementStats = null
  } = {}) {
    this.deletePendingGameSummary = deletePendingGameSummary
    this.savePendingGameSummary = savePendingGameSummary
    this.updateAchievementStats = updateAchievementStats
  }

  createRecord(game, win) {
    const endedAt = Date.now()
    const users = game.users || {}
    const players = Object.entries(users)
      .filter(([, user]) => user.role === 'player')
      .map(([userId]) => userId)
    const spectators = Object.entries(users)
      .filter(([, user]) => user.role === 'spectator')
      .map(([userId]) => userId)
    const storyteller = Object.entries(users)
      .find(([, user]) => user.role === 'storyteller')?.[0] || game.storytellerId || null
    const startedAt = game.startedAt || game.createdAt || null

    return {
      id: `${game.guildId || 'unknown'}-${endedAt}`,
      guildId: game.guildId,
      scriptId: game.scriptId,
      script: game.script,
      storytellerId: storyteller,
      winner: win.winner,
      reason: win.reason,
      createdAt: game.createdAt || null,
      startedAt,
      endedAt,
      durationMs: startedAt ? endedAt - startedAt : null,
      day: game.day || 1,
      phase: game.phase || null,
      players,
      spectators,
      roles: { ...(game.roles || {}) },
      roleCategories: { ...(game.roleCategories || {}) },
      alivePlayers: [...(game.alivePlayers || [])],
      deadPlayers: [...(game.deadPlayers || [])],
      nightVoiceChannels: { ...(game.nightVoiceChannels || {}) },
      storytellerDenChannelId: game.storytellerDenChannelId || null,
      townsquareChannelId: game.townsquareChannelId || null,
      deadVotes: { ...(game.deadVotes || {}) },
      nominations: [...(game.nominations || [])],
      executionHistory: [...(game.executionHistory || [])],
      reminders: [...(game.reminders || [])],
      stats: {
        playerCount: players.length,
        spectatorCount: spectators.length,
        nominationCount: (game.nominations || []).length,
        executionCount: (game.executionHistory || []).length,
        reminderCount: (game.reminders || []).length,
        nightActionCount: (game.nightActions || []).length
      }
    }
  }

  save(game, win) {
    if (!game?.guildId) return false

    const record = this.createRecord(game, win)
    if (this.updateAchievementStats) this.updateAchievementStats(record)
    if (!this.savePendingGameSummary) return record
    return this.savePendingGameSummary(record)
  }

  discardPending(guildId) {
    if (!guildId || !this.deletePendingGameSummary) return false
    return this.deletePendingGameSummary(guildId)
  }
}

module.exports = SessionHistoryService
