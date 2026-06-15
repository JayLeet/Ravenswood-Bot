const {
  createBotLogger
} = require('../../../utils/logger')

function createRecoverySystem({
  serverConfigs,
  gameManager,
  saveGames,
  isSetupComplete,
  postOrUpdateGamePanel,
  postOrUpdatePlayerGrimoirePanel = null,
  ensureConfiguredGuildReady,
  gameLifecycle,
  restoreGameMembers,
  applyPhaseChannelPermissions,
  syncGameVoiceChannels,
  postOrUpdateStorytellerDashboard,
  recoverVotingPanels,
  recoverNightActionPrompts,
  locks = null
}) {
  const log = createBotLogger({ subsystem: 'Recovery' })
  const runtimeState = {
    activePasses: 0,
    activeGuilds: new Set(),
    lastActiveCompletedAt: 0,
    lastActiveStartedAt: 0,
    lastActiveSummary: null,
    lastSessionCompletedAt: 0,
    lastSessionGuildId: null,
    lastSessionResult: null,
    lastSessionStartedAt: 0
  }

  async function recoverActiveGames(discordClient) {
    runtimeState.activePasses += 1
    runtimeState.lastActiveStartedAt = Date.now()
    const summary = {
      gamePanels: 0,
      playerGrimoirePanels: 0,
      games: 0,
      roles: 0,
      stateRepairs: 0,
      nightActionsCreated: 0,
      nightActionsCancelled: 0,
      voiceChannels: 0,
      storytellerDashboards: 0,
      voteCountsResumed: 0,
      votingPanels: 0,
      nightPrompts: 0,
      skipped: 0
    }

    try {
      for (const [guildId, serverConfig] of serverConfigs.entries()) {
        if (!isSetupComplete(serverConfig)) continue
        if (gameManager.games.has(guildId)) continue

        const panel = await recover('refresh-game-panel-no-active-game', () => postOrUpdateGamePanel(discordClient, guildId), { guildId })

        if (panel) summary.gamePanels += 1

        const grimoirePanel = await recover(
          'refresh-player-grimoire-panel-no-active-game',
          () => postOrUpdatePlayerGrimoirePanel?.(discordClient, guildId),
          { guildId }
        )

        if (grimoirePanel) summary.playerGrimoirePanels += 1
      }

      for (const guildId of [...gameManager.games.keys()]) {
        const task = () => recoverGameSession(discordClient, guildId)
        const recovered = await recover('recover-game-session', () => locks ? locks.run(guildId, task) : task(), { guildId })

        if (!recovered) {
          summary.skipped += 1
          continue
        }

        summary.games += 1
        summary.roles += recovered.roles
        summary.stateRepairs += recovered.stateRepairs
        summary.nightActionsCreated += recovered.nightActionsCreated
        summary.nightActionsCancelled += recovered.nightActionsCancelled
        summary.voiceChannels += recovered.voiceChannels
        summary.gamePanels += recovered.gamePanel
        summary.playerGrimoirePanels += recovered.playerGrimoirePanel
        summary.storytellerDashboards += recovered.storytellerDashboard
        summary.voteCountsResumed += recovered.voteCountsResumed || 0
        summary.votingPanels += recovered.votingPanels
        summary.nightPrompts += recovered.nightPrompts
      }

      saveGames(gameManager.games)

      log.info('recover-active-games-complete', 'Recovery pass complete.', summary)
      return summary
    } finally {
      runtimeState.activePasses = Math.max(0, runtimeState.activePasses - 1)
      runtimeState.lastActiveCompletedAt = Date.now()
      runtimeState.lastActiveSummary = { ...summary }
    }
  }

  async function recoverGameSession(discordClient, guildId) {
    runtimeState.activeGuilds.add(guildId)
    runtimeState.lastSessionGuildId = guildId
    runtimeState.lastSessionStartedAt = Date.now()
    let result = null
    let failed = false

    try {
      result = await recoverGameSessionNow(discordClient, guildId)
      return result
    } catch (err) {
      failed = true
      throw err
    } finally {
      runtimeState.activeGuilds.delete(guildId)
      runtimeState.lastSessionCompletedAt = Date.now()
      runtimeState.lastSessionResult = result
        ? { ...result }
        : { failed }
    }
  }

  async function recoverGameSessionNow(discordClient, guildId) {
    const serverConfig = serverConfigs.get(guildId)
    if (!isSetupComplete(serverConfig)) return null

    const guild = discordClient.guilds.cache.get(guildId) ||
      await recover('fetch-guild', () => discordClient.guilds.fetch(guildId), { guildId })

    if (!guild) return null

    const stateRecovery = await gameLifecycle.recoverGameState(guildId)
    if (!stateRecovery.ok) return null

    const game = stateRecovery.game

    const readiness = await ensureConfiguredGuildReady(discordClient, guild, serverConfig)
    if (!readiness.ok) {
      log.warn('guild-readiness-skipped', readiness.message, { guildId })
      return null
    }

    const view = stateRecovery.view
    const roles = await restoreGameMembers(guild, game)

    const gamePanel = await recover('refresh-game-panel', () => postOrUpdateGamePanel(discordClient, guildId), { guildId })

    const playerGrimoirePanel = await recover('refresh-player-grimoire-panel', () => postOrUpdatePlayerGrimoirePanel?.(discordClient, guildId), { guildId })

    await recover('apply-phase-channel-permissions', () => applyPhaseChannelPermissions(discordClient, guildId), { guildId })

    const voiceChannels = await recover('sync-game-voice-channels', () => syncGameVoiceChannels(discordClient, guildId), { guildId }) || 0

    const storytellerDashboard = await recover('refresh-storyteller-dashboard', () => postOrUpdateStorytellerDashboard(discordClient, guildId), { guildId })

    const votingRecovery = normalizeVotingRecovery(await recover(
      'recover-voting-panels',
      () => recoverVotingPanels(discordClient, guildId, view),
      { guildId }
    ))
    const nightPrompts = await recover(
      'recover-night-action-prompts',
      () => recoverNightActionPrompts(discordClient, guild, serverConfig, game, view),
      { guildId }
    ) || 0

    return {
      roles,
      stateRepairs: stateRecovery.summary.changed ? 1 : 0,
      nightActionsCreated: stateRecovery.summary.nightActionsCreated,
      nightActionsCancelled: stateRecovery.summary.nightActionsCancelled,
      voiceChannels,
      gamePanel: gamePanel ? 1 : 0,
      playerGrimoirePanel: playerGrimoirePanel ? 1 : 0,
      storytellerDashboard: storytellerDashboard ? 1 : 0,
      voteCountsResumed: votingRecovery.voteCountsResumed,
      votingPanels: votingRecovery.votingPanels,
      nightPrompts
    }
  }

  function getRuntimeState() {
    return {
      activeGuilds: runtimeState.activeGuilds.size,
      activePasses: runtimeState.activePasses,
      lastActiveCompletedAt: runtimeState.lastActiveCompletedAt,
      lastActiveStartedAt: runtimeState.lastActiveStartedAt,
      lastActiveSummary: runtimeState.lastActiveSummary,
      lastSessionCompletedAt: runtimeState.lastSessionCompletedAt,
      lastSessionGuildId: runtimeState.lastSessionGuildId,
      lastSessionResult: runtimeState.lastSessionResult,
      lastSessionStartedAt: runtimeState.lastSessionStartedAt
    }
  }

  return {
    getRuntimeState,
    recoverActiveGames,
    recoverGameSession
  }

  async function recover(action, fn, context = {}) {
    try {
      return await fn()
    } catch (err) {
      log.recoverable(action, err, context)
      return null
    }
  }
}

function normalizeVotingRecovery(result) {
  if (typeof result === 'number') {
    return {
      voteCountsResumed: 0,
      votingPanels: result
    }
  }

  return {
    voteCountsResumed: Number(result?.voteCountsResumed || 0),
    votingPanels: Number(result?.votingPanels || 0)
  }
}

module.exports = {
  createRecoverySystem
}
