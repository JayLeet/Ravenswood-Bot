const {
  sendBotUpdateNotices
} = require('../discord/botUpdateNotifier')
const {
  createClientReadyHandler,
  createGuildCreateHandler,
  sendMissingFirstJoinSetupNotices
} = require('./runtimeEventHandlers')

function createRuntimeEventHandlers({
  client,
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
  return {
    handleClientReady: createClientReadyHandler({
      client,
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
    })
  }
}

module.exports = {
  createRuntimeEventHandlers
}
