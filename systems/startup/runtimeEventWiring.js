const {
  sendBotUpdateNotices
} = require('../discord/botUpdateNotifier')
const {
  createGameChatCapture
} = require('../discord/gameChatCapture')
const {
  createClientReadyHandler,
  createGuildCreateHandler,
  createGuildDeleteHandler,
  sendMissingFirstJoinSetupNotices
} = require('./runtimeEventHandlers')

function createRuntimeEventHandlers({
  client,
  chatCaptureDeps,
  deletePendingGameSummariesNotInGuilds,
  deletePendingGameSummary,
  ensureConfiguredGuildReady,
  gameVoiceChannels,
  idleLobby,
  isSetupComplete,
  memberNicknameSync,
  nightActionPrompts,
  phasePermissions,
  recovery,
  registerNightAreaDayRelease,
  roleInfoRefresh,
  saveServerConfigs,
  serverConfigs,
  startingRoleInfo,
  storytellerDashboard,
  updateLog,
  votingPanels
}) {
  const gameChatCapture = createGameChatCapture({
    ...chatCaptureDeps,
    serverConfigs
  })

  return {
    handleClientReady: createClientReadyHandler({
      client,
      deletePendingGameSummariesNotInGuilds,
      recoverActiveGames: recovery.recoverActiveGames,
      registerGameVoiceChannels: gameVoiceChannels.registerGameVoiceChannels,
      registerIdleLobbyWatch: idleLobby.registerIdleLobbyWatch,
      registerMemberNicknameSync: memberNicknameSync.registerMemberNicknameSync,
      registerNightActionPromptDispatch: nightActionPrompts.registerNightActionPromptDispatch,
      registerNightAreaDayRelease,
      registerPhaseChannelPermissions: phasePermissions.registerPhaseChannelPermissions,
      registerRoleInfoRefreshDispatch: roleInfoRefresh.registerRoleInfoRefreshDispatch,
      registerStartingRoleInfoDispatch: startingRoleInfo.registerStartingRoleInfoDispatch,
      registerStorytellerDashboardRefresh: storytellerDashboard.registerStorytellerDashboardRefresh,
      registerVotingPanelRefresh: votingPanels.registerVotingPanelRefresh,
      sendMissingFirstJoinSetupNotices: () => sendMissingFirstJoinSetupNotices({
        client,
        isSetupComplete,
        saveServerConfigs,
        serverConfigs
      }),
      sendStartupUpdateNotices: () => sendBotUpdateNotices({ client, serverConfigs, saveServerConfigs, updateLog })
    }),
    handleGuildCreate: createGuildCreateHandler({
      client,
      ensureConfiguredGuildReady,
      isSetupComplete,
      saveServerConfigs,
      serverConfigs
    }),
    handleGuildDelete: createGuildDeleteHandler({
      deletePendingGameSummary
    }),
    handleMessageCreate: gameChatCapture.handleMessageCreate
  }
}

module.exports = {
  createRuntimeEventHandlers
}
