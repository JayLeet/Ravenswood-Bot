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
      displayNames: this.getDisplayNames(users),
      chatMessages: [...(game.chatMessages || [])],
      chatMessagesDropped: Number(game.chatMessagesDropped) || 0,
      roles: { ...(game.roles || {}) },
      shownRoles: { ...(game.shownRoles || {}) },
      roleCategories: { ...(game.roleCategories || {}) },
      roleHistory: { ...(game.roleHistory || {}) },
      alivePlayers: [...(game.alivePlayers || [])],
      deadPlayers: [...(game.deadPlayers || [])],
      nightVoiceChannels: { ...(game.nightVoiceChannels || {}) },
      storytellerDenChannelId: game.storytellerDenChannelId || null,
      townsquareChannelId: game.townsquareChannelId || null,
      deadVotes: { ...(game.deadVotes || {}) },
      demonNotInPlayRoles: { ...(game.demonNotInPlayRoles || {}) },
      nominations: [...(game.nominations || [])],
      nightActions: [...(game.nightActions || [])],
      votes: [...(game.votes || [])],
      executionHistory: [...(game.executionHistory || [])],
      messages: [...(game.messages || [])],
      reminders: [...(game.reminders || [])],
      statusEffects: { ...(game.statusEffects || {}) },
      stats: {
        playerCount: players.length,
        chatMessageCount: (game.chatMessages || []).length,
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

  getDisplayNames(users) {
    return Object.fromEntries(
      Object.entries(users || {})
        .filter(([, user]) => user.displayName)
        .map(([userId, user]) => [userId, user.displayName])
    )
  }
}

module.exports = SessionHistoryService
