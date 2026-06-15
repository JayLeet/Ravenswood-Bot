class GameSerializer {
  constructor({
    phases,
    voting,
    nightActions,
    roles,
    scripts
  }) {
    this.phases = phases
    this.voting = voting
    this.nightActions = nightActions
    this.roles = roles
    this.scripts = scripts
  }

  serializeGame(game, context = {}) {
    const users = game.users || {}

    const players = []
    const spectators = []
    const fakePlayers = []
    let storyteller = null

    for (const [userId, data] of Object.entries(users)) {
      if (data.role === 'player') {
        players.push(userId)
        if (data.fake === true) fakePlayers.push(userId)
      }
      if (data.role === 'spectator') spectators.push(userId)
      if (data.role === 'storyteller') storyteller = userId
    }

    const pendingNominationRequests = this.voting.getPendingNominationRequests(game)

    return {
      guildId: context.guildId ?? null,
      state: game.state,
      phase: game.phase ?? null,
      phaseLabel: this.phases.formatPhase(game),
      day: game.day,
      scriptId: game.scriptId,
      script: game.script,
      gameMode: game.gameMode || 'discord-only',
      testMode: game.testMode === true,
      maxPlayers: game.maxPlayers,
      storytellerId: storyteller,
      winner: game.winner ?? null,
      winReason: game.winReason ?? null,
      pendingEndReveal: game.pendingEndReveal ?? null,
      pendingManualImpReplacement: game.pendingManualImpReplacement ?? null,
      paused: game.paused || null,
      replacementSlot: game.replacementSlot || null,

      counts: {
        players: players.length,
        alive: (game.alivePlayers || []).length,
        dead: (game.deadPlayers || []).length,
        spectators: spectators.length,
        total: Object.keys(users).length,
        nominations: (game.nominations || []).length
      },

      users: {
        players,
        fakePlayers,
        alivePlayers: game.alivePlayers || [],
        deadPlayers: game.deadPlayers || [],
        spectators,
        storyteller,
        displayNames: this.getDisplayNames(game)
      },

      engine: {
        nominations: game.nominations || [],
        nominationRequests: pendingNominationRequests,
        latestNomination: this.voting.serializeNomination(game, this.voting.getLatestNomination(game)),
        activeNomination: this.voting.serializeNomination(
          game,
          this.voting.getLatestNomination(game, null, ['pending_second', 'seconded', 'voting'])
        ),
        executionHistory: game.executionHistory || [],
        executedPlayer: game.executedPlayer ?? null,
        executionCandidate: game.executionCandidate ?? null,
        demonNotInPlayRoles: game.demonNotInPlayRoles || {},
        lunaticInfo: game.lunaticInfo || {},
        nightOptions: game.nightOptions || {},
        nightActions: game.nightActions || [],
        nightActionCounts: this.nightActions.countByStatus(game),
        nightChannels: game.nightChannels || {},
        nightVoiceChannels: game.nightVoiceChannels || {},
        storytellerDenChannelId: game.storytellerDenChannelId || null,
        townsquareChannelId: game.townsquareChannelId || null,
        voteClockhandSpeedMs: game.voteClockhandSpeedMs,
        votes: game.votes || [],
        deadVotes: game.deadVotes || {},
        roles: game.roles || {},
        shownRoles: game.shownRoles || {},
        roleHistory: game.roleHistory || {},
        roleCategories: game.roleCategories || this.roles.createDefaultRoleCategories(game.scriptId),
        roleNames: this.scripts.getRoleNameMap(game.scriptId),
        reminders: game.reminders || [],
        statusEffects: game.statusEffects || {}
      },

      requests: {
        pending: (game.requests || []).filter(req => req.status === 'pending').length,
        nominationPending: pendingNominationRequests.length
      }
    }
  }

  getDisplayNames(game) {
    return Object.fromEntries(
      Object.entries(game.users || {})
        .filter(([, user]) => user.displayName)
        .map(([userId, user]) => [userId, user.displayName])
    )
  }
}

module.exports = GameSerializer
