const {
  getBotUpdateNoticeRuntimeState
} = require('../discord/botUpdateNotifier')
const {
  getGongTimerRuntimeState
} = require('../discord/interactions/gongTimer')
const {
  nightActionDraftSize,
  pruneNightActionDrafts
} = require('../discord/interactions/nightActionDrafts')
const {
  registerRuntimeMaintenanceTask
} = require('../../utils/runtimeMaintenance')
const {
  getRecoverableFetchRuntimeState
} = require('../../utils/discord/recoverableFetch')

function registerRuntimeMaintenanceSystems({
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
}) {
  registerRuntimeMaintenanceTask('idleLobbyWatch', () => ({
    active: idleLobby.size(),
    warningMemory: idleLobby.warningMemorySize(),
    removedWarningMemory: idleLobby.prune?.() || 0
  }))
  registerRuntimeMaintenanceTask('database', () => ({
    optimized: optimizeDatabase()
  }))
  registerRuntimeMaintenanceTask('memberNicknameSync', () =>
    memberNicknameSync.getRuntimeState?.() || { pendingGuilds: memberNicknameSync.pendingGuildsSize() })
  registerRuntimeMaintenanceTask('recoverableFetch', () => getRecoverableFetchRuntimeState())
  registerRuntimeMaintenanceTask('botUpdateNotices', () => getBotUpdateNoticeRuntimeState())
  registerRuntimeMaintenanceTask('gameLifecycle', () => gameLifecycle.getRuntimeState())
  registerRuntimeMaintenanceTask('recovery', () => recovery?.getRuntimeState?.() || { unavailable: true })
  registerRuntimeMaintenanceTask('setupAccessChoiceFlight', ({ now }) => setupAccessChoice.getRuntimeState({ now }))
  registerRuntimeMaintenanceTask('setupChannelsFlight', ({ now }) => setupChannels.getRuntimeState({ now }))
  registerRuntimeMaintenanceTask('setupUnsafeRolesFlight', ({ now }) => setupUnsafeRoles.getRuntimeState({ now }))
  registerRuntimeMaintenanceTask('gamePanel', () => gamePanel.getRuntimeState())
  registerRuntimeMaintenanceTask('playerGrimoirePanel', () => playerGrimoirePanel.getRuntimeState())
  registerRuntimeMaintenanceTask('votingPanels', ({ now }) => votingPanels.getRuntimeState({ now }))
  registerRuntimeMaintenanceTask('gongTimers', ({ now }) => getGongTimerRuntimeState({ now }))
  registerRuntimeMaintenanceTask('nightActionDrafts', ({ now }) => ({
    removed: pruneNightActionDrafts(now),
    size: nightActionDraftSize()
  }))
  registerRuntimeMaintenanceTask('startingRoleInfo', () => startingRoleInfo.getRuntimeState())
  registerRuntimeMaintenanceTask('roleInfoRefresh', () => roleInfoRefresh.getRuntimeState())
  registerRuntimeMaintenanceTask('setupSettingsFlight', ({ now }) => setupSettings.getRuntimeState({ now }))
}

module.exports = {
  registerRuntimeMaintenanceSystems
}
