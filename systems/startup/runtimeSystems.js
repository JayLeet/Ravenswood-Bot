const path = require('node:path')
const {
  deleteExpiredPendingGameSummaries,
  deletePendingGameSummariesNotInGuilds,
  deletePendingGameSummary,
  loadCreateGameCooldowns,
  loadPendingGameSummary,
  optimizeDatabase,
  pruneCreateGameCooldowns,
  saveCreateGameCooldown,
  saveGames,
  savePendingGameSummary,
  saveServerConfigs,
  updateAchievementStats
} = require('../persistence')
const { loadCommands } = require('../discord/commandLoader')
const { createMemberRecovery } = require('../discord/memberRecovery')
const { createMemberNicknameSync } = require('../discord/memberNicknames')
const { createPhaseChannelPermissionSystem } = require('../discord/phaseChannelPermissions')
const { createSetupReadiness } = require('../discord/setupReadiness')
const { createBotUpdateNotificationInteractionSystem } = require('../discord/interactions/botUpdateNotifications')
const { createFirstJoinSetupNoticeInteractionSystem } = require('../discord/interactions/firstJoinSetupNotice')
const { createGamePanelSystem } = require('../discord/interactions/gamePanel')
const { createGameLogInteractionSystem } = require('../discord/interactions/gameLog')
const { createGameVoiceChannelSystem } = require('../discord/interactions/voiceChannels')
const { createIdleLobbyWatchSystem } = require('../discord/interactions/idleLobbyWatch')
const { createInteractionRouter } = require('../discord/interactions/router')
const { createNightActionPromptSystem } = require('../discord/interactions/nightActionPrompts')
const { createNightAreaDayReleaseSystem } = require('../discord/interactions/nightArea/dayReleaseSystem')
const { createNominationRequestInteractionSystem } = require('../discord/interactions/nominationRequests')
const { createPlayerGrimoireInteractionSystem } = require('../discord/interactions/playerGrimoire')
const { createPlayerGrimoirePanelSystem } = require('../discord/interactions/playerGrimoirePanel')
const { createPrivateVoiceRequestInteractionSystem } = require('../discord/interactions/privateVoiceRequests')
const { createRecoverySystem } = require('../discord/interactions/recovery')
const { createRequestDecisionInteractionSystem } = require('../discord/interactions/requestDecisions')
const { createRoleInfoRefreshSystem } = require('../discord/interactions/roleInfoRefresh')
const { createSetupAccessChoiceInteractionSystem } = require('../discord/interactions/setupAccessChoice')
const { createSetupChannelsInteractionSystem } = require('../discord/interactions/setupChannels')
const { createSetupDeleteInteractionSystem } = require('../discord/interactions/setupDelete')
const { createSetupSettingsPanelSystem } = require('../discord/interactions/setupSettingsPanel')
const { createSetupUnsafeRoleInteractionSystem } = require('../discord/interactions/setupUnsafeRoles')
const { createStorytellerRequestInteractionSystem } = require('../discord/interactions/storytellerRequests')
const { createStorytellerDashboardSystem } = require('../discord/interactions/storytellerDashboard')
const { createStartingRoleInfoSystem } = require('../discord/interactions/startingRoleInfo')
const { createVotingPanelSystem } = require('../discord/interactions/votingPanels')
const { loadBotUpdateLog } = require('../../utils/updateLog')
const { logStartupStep } = require('../../utils/startupDiagnostics')
const { createGameLifecycleRuntime } = require('./gameLifecycleRuntime')
const { registerRuntimeMaintenanceSystems } = require('./runtimeMaintenanceRegistration')
const { createRuntimeEventHandlers } = require('./runtimeEventWiring')
const GameManager = require('../GameManager')
const GuildLockService = require('../game/concurrency/GuildLockService')

function createRuntimeSystems({ client, games, serverConfigs }) {
  const gameManager = new GameManager(games)
  const interactionLocks = new GuildLockService()
  const services = {}
  const updateLog = loadBotUpdateLog()
  const readiness = createSetupReadiness({ gameManager, serverConfigs })
  const {
    createSetupRequiredMessage,
    ensureConfiguredGuildReady,
    ensureConfiguredServerReady,
    getConfiguredChannels,
    isSetupComplete
  } = readiness
  const { restoreGameMembers } = createMemberRecovery({ gameManager })
  const gameLifecycle = createGameLifecycleRuntime({
    deleteExpiredPendingGameSummaries,
    deletePendingGameSummary,
    gameManager,
    loadCreateGameCooldowns,
    pruneCreateGameCooldowns,
    saveCreateGameCooldown,
    saveGames,
    savePendingGameSummary,
    updateAchievementStats
  })
  const memberNicknameSync = createMemberNicknameSync({ client, gameLifecycle, gameManager })
  const phasePermissions = createPhaseChannelPermissionSystem({
    client,
    gameLifecycle,
    gameManager,
    isSetupComplete,
    serverConfigs
  })
  const { registerNightAreaDayRelease } = createNightAreaDayReleaseSystem({ client, gameLifecycle })

  logStartupStep('Creating Discord interaction systems...')
  const gamePanel = createGamePanelSystem({
    client,
    serverConfigs,
    saveServerConfigs,
    createSetupRequiredMessage,
    isSetupComplete,
    ensureConfiguredServerReady,
    gameLifecycle,
    gameManager,
    restoreGameMembers,
    services
  })
  Object.assign(services, { sendGamePanelNotices: gamePanel.sendGamePanelNotices })
  const botUpdateNotifications = createBotUpdateNotificationInteractionSystem({ serverConfigs, saveServerConfigs })
  const gameLog = createGameLogInteractionSystem({ deletePendingGameSummary, loadPendingGameSummary, serverConfigs })
  const setupSettings = createSetupSettingsPanelSystem({ gameManager, serverConfigs })
  const storytellerDashboard = createStorytellerDashboardSystem({
    client,
    deletePendingGameSummary,
    serverConfigs,
    saveServerConfigs,
    createSetupRequiredMessage,
    ensureConfiguredServerReady,
    isSetupComplete,
    gameLifecycle,
    gameManager,
    services
  })
  Object.assign(services, {
    postOrUpdateStorytellerDashboard: storytellerDashboard.postOrUpdateStorytellerDashboard
  })
  const idleLobby = createIdleLobbyWatchSystem({
    client,
    gameLifecycle,
    postOrUpdateStorytellerDashboard: storytellerDashboard.postOrUpdateStorytellerDashboard,
    serverConfigs
  })
  const setupAccessChoice = createSetupAccessChoiceInteractionSystem({ gameManager, saveServerConfigs, serverConfigs })
  const setupChannels = createSetupChannelsInteractionSystem({ gameManager, saveServerConfigs, serverConfigs })
  const setupDelete = createSetupDeleteInteractionSystem({ gameLifecycle, saveServerConfigs, serverConfigs })
  const setupUnsafeRoles = createSetupUnsafeRoleInteractionSystem({ gameManager, saveServerConfigs, serverConfigs })
  const firstJoinSetupNotice = createFirstJoinSetupNoticeInteractionSystem({ client, gameManager, saveServerConfigs, serverConfigs })
  const nominationRequests = createNominationRequestInteractionSystem({
    gameLifecycle,
    postOrUpdateStorytellerDashboard: storytellerDashboard.postOrUpdateStorytellerDashboard
  })
  const playerGrimoire = createPlayerGrimoireInteractionSystem({
    gameLifecycle,
    getPlayerLabels: storytellerDashboard.getDashboardPlayerLabels
  })
  const playerGrimoirePanel = createPlayerGrimoirePanelSystem({
    isSetupComplete,
    saveServerConfigs,
    serverConfigs
  })
  const votingPanels = createVotingPanelSystem({
    client,
    gameLifecycle,
    getDashboardPlayerLabels: storytellerDashboard.getDashboardPlayerLabels,
    isSetupComplete,
    postOrUpdateStorytellerDashboard: storytellerDashboard.postOrUpdateStorytellerDashboard,
    serverConfigs
  })
  Object.assign(services, { postOrUpdateVotingPanel: votingPanels.postOrUpdateVotingPanel })

  const nightActionPrompts = createNightActionPromptSystem({
    client,
    gameLifecycle,
    getDashboardPlayerLabels: storytellerDashboard.getDashboardPlayerLabels,
    isSetupComplete,
    postOrUpdateStorytellerDashboard: storytellerDashboard.postOrUpdateStorytellerDashboard,
    serverConfigs
  })
  Object.assign(services, {
    ensurePlayerNightChannel: nightActionPrompts.ensurePlayerNightChannel,
    ensurePlayerNightVoiceChannel: nightActionPrompts.ensurePlayerNightVoiceChannel
  })

  const gameVoiceChannels = createGameVoiceChannelSystem({
    client,
    ensureConfiguredGuildReady,
    findNightChannelParent: nightActionPrompts.findNightChannelParent,
    gameLifecycle,
    gameManager,
    isSetupComplete,
    serverConfigs
  })
  Object.assign(services, { ensureStorytellerDenVoiceChannel: gameVoiceChannels.ensureStorytellerDenVoiceChannel })
  const privateVoiceRequests = createPrivateVoiceRequestInteractionSystem({
    gameLifecycle,
    gameVoiceChannels
  })

  const startingRoleInfo = createStartingRoleInfoSystem({
    client,
    findNightChannelParent: nightActionPrompts.findNightChannelParent,
    gameLifecycle,
    gameManager,
    isSetupComplete,
    serverConfigs
  })
  const roleInfoRefresh = createRoleInfoRefreshSystem({
    client,
    findNightChannelParent: nightActionPrompts.findNightChannelParent,
    gameLifecycle,
    getPlayerLabels: storytellerDashboard.getDashboardPlayerLabels,
    isSetupComplete,
    serverConfigs
  })
  const requestDecisions = createRequestDecisionInteractionSystem({ gameLifecycle, serverConfigs })
  const storytellerRequests = createStorytellerRequestInteractionSystem({ gameLifecycle, serverConfigs })
  const recovery = createRecoverySystem({
    applyPhaseChannelPermissions: phasePermissions.applyPhaseChannelPermissions,
    ensureConfiguredGuildReady,
    gameLifecycle,
    gameManager,
    isSetupComplete,
    locks: interactionLocks,
    postOrUpdateGamePanel: gamePanel.postOrUpdateGamePanel,
    postOrUpdatePlayerGrimoirePanel: playerGrimoirePanel.postOrUpdatePlayerGrimoirePanel,
    postOrUpdateStorytellerDashboard: storytellerDashboard.postOrUpdateStorytellerDashboard,
    recoverNightActionPrompts: nightActionPrompts.recoverNightActionPrompts,
    recoverVotingPanels: votingPanels.recoverVotingPanels,
    restoreGameMembers,
    saveGames,
    serverConfigs,
    syncGameVoiceChannels: gameVoiceChannels.syncGameVoiceChannels
  })
  Object.assign(services, { recoverGameSession: recovery.recoverGameSession })
  registerRuntimeMaintenanceSystems({
    gameLifecycle,
    gamePanel,
    idleLobby,
    memberNicknameSync,
    optimizeDatabase,
    playerGrimoirePanel,
    recovery,
    roleInfoRefresh,
    setupAccessChoice,
    setupChannels,
    setupSettings,
    setupUnsafeRoles,
    startingRoleInfo,
    votingPanels
  })

  logStartupStep('Loading commands...')
  loadCommands(client, path.join(__dirname, '..', '..', 'commands'))

  const { handleInteraction } = createInteractionRouter({
    client,
    deletePendingGameSummary,
    gameLifecycle,
    gameManager,
    serverConfigs,
    saveServerConfigs,
    isSetupComplete,
    createSetupRequiredMessage,
    getConfiguredChannels,
    handleBotUpdateNotificationInteraction: botUpdateNotifications.handleBotUpdateNotificationInteraction,
    handleFirstJoinSetupNoticeInteraction: firstJoinSetupNotice.handleFirstJoinSetupNoticeInteraction,
    handleGamePanelInteraction: gamePanel.handleGamePanelInteraction,
    handleGameLogInteraction: gameLog.handleGameLogInteraction,
    handleIdleLobbyInteraction: idleLobby.handleIdleLobbyInteraction,
    handleNightActionInteraction: nightActionPrompts.handleNightActionInteraction,
    handleNominationRequestInteraction: nominationRequests.handleNominationRequestInteraction,
    handlePlayerGrimoireInteraction: playerGrimoire.handlePlayerGrimoireInteraction,
    handlePrivateVoiceRequestInteraction: privateVoiceRequests.handlePrivateVoiceRequestInteraction,
    handleRequestDecisionInteraction: requestDecisions.handleRequestDecisionInteraction,
    handleSetupAccessChoiceInteraction: setupAccessChoice.handleSetupAccessChoiceInteraction,
    handleSetupChannelsInteraction: setupChannels.handleSetupChannelsInteraction,
    handleSetupDeleteInteraction: setupDelete.handleSetupDeleteInteraction,
    handleSetupSettingsInteraction: setupSettings.handleSetupSettingsInteraction,
    handleSetupUnsafeRoleInteraction: setupUnsafeRoles.handleSetupUnsafeRoleInteraction,
    handleStorytellerRequestInteraction: storytellerRequests.handleStorytellerRequestInteraction,
    handleStorytellerDashboardInteraction: storytellerDashboard.handleStorytellerDashboardInteraction,
    handleVotingInteraction: votingPanels.handleVotingInteraction,
    postOrUpdateStorytellerDashboard: storytellerDashboard.postOrUpdateStorytellerDashboard
  })

  const runtimeEventHandlers = createRuntimeEventHandlers({
    client,
    chatCaptureDeps: { gameManager, loadPendingGameSummary, saveGames, savePendingGameSummary },
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
  })

  return {
    handleInteraction,
    ...runtimeEventHandlers
  }
}

module.exports = { createRuntimeSystems }
