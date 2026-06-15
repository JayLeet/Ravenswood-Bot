const {
  ensureStorytellerDashboardReady: createDashboardContext
} = require('./storytellerDashboard/context')
const {
  createStorytellerDashboardButtonHandler
} = require('./storytellerDashboard/buttons')
const {
  createDashboardLifecycleResultHandler
} = require('./storytellerDashboard/lifecycleResult')
const {
  getGongButtonRuntimeState,
  registerGongPhaseRestore
} = require('./storytellerDashboard/gongButton')
const {
  createStorytellerDashboardModalHandler
} = require('./storytellerDashboard/modals')
const {
  createStorytellerPlayerActionRunner
} = require('./storytellerDashboard/playerActions')
const {
  createStorytellerDashboardRenderer
} = require('./storytellerDashboard/renderer')
const {
  createStorytellerDashboardSelectHandler
} = require('./storytellerDashboard/selects')
const {
  createStorytellerDashboardState
} = require('./storytellerDashboard/state')
const {
  createStorytellerDashboardStatus
} = require('./storytellerDashboard/statusMessage')
const {
  getNightOrderStateRuntimeState
} = require('./storytellerDashboard/nightOrderState')
const {
  registerRuntimeMaintenanceTask
} = require('../../../utils/runtimeMaintenance')

function createStorytellerDashboardSystem({
  client,
  serverConfigs,
  saveServerConfigs,
  gameLifecycle,
  gameManager,
  isSetupComplete,
  createSetupRequiredMessage,
  ensureConfiguredServerReady,
  services
}) {
  let dashboardRenderer = null
  let gongPhaseRestoreRegistered = false
  let dashboardRefreshRegistered = false
  const dashboardState = createStorytellerDashboardState({
    client,
    gameLifecycle,
    serverConfigs,
    saveServerConfigs,
    refreshDashboard: (...args) => dashboardRenderer.postOrUpdate(...args),
    clearDashboardRender: guildId => dashboardRenderer?.clear(guildId)
  })
  const dashboardStatus = createStorytellerDashboardStatus({
    serverConfigs,
    saveServerConfigs
  })
  dashboardRenderer = createStorytellerDashboardRenderer({
    serverConfigs,
    saveServerConfigs,
    gameLifecycle,
    isSetupComplete,
    dashboardState,
    moveStatusMessageToBottom: dashboardStatus.moveToBottom
  })
  registerRuntimeMaintenanceTask('storytellerDashboardMemberLabels', () => ({
    removed: dashboardRenderer.pruneMemberDisplayNameCache?.() || 0,
    removedMessageSignatures: dashboardRenderer.pruneMessageSignatures?.() || 0,
    size: dashboardRenderer.memberDisplayNameCacheSize?.() || 0,
    ...(dashboardRenderer.getRuntimeState?.() || {})
  }))
  registerRuntimeMaintenanceTask('storytellerDashboardStatus', () => dashboardStatus.getRuntimeState())
  registerRuntimeMaintenanceTask('storytellerDashboardGong', () => getGongButtonRuntimeState())
  registerRuntimeMaintenanceTask('storytellerDashboardNightOrderState', () =>
    getNightOrderStateRuntimeState({ activeGuildIds: getActiveGameGuildIds(gameLifecycle) }))
  registerRuntimeMaintenanceTask('storytellerDashboardState', ({ now }) => dashboardState.getRuntimeState({ now }))
  const playerActions = createStorytellerPlayerActionRunner({
    gameLifecycle,
    services,
    getDashboardPlayerLabels: dashboardRenderer.getPlayerLabels
  })

  function registerStorytellerDashboardRefresh() {
    if (dashboardRefreshRegistered) return false
    dashboardRefreshRegistered = true

    dashboardState.registerRefresh()
    if (!gongPhaseRestoreRegistered) {
      registerGongPhaseRestore(gameLifecycle, client)
      gongPhaseRestoreRegistered = true
    }

    return true
  }

  function clearStorytellerDashboardState(guildId) {
    dashboardState.clear(guildId)
  }

  async function postOrUpdateStorytellerDashboard(discordClient, guildId, selectedPlayerId = null) {
    return dashboardRenderer.postOrUpdate(discordClient, guildId, selectedPlayerId)
  }

  async function getDashboardPlayerLabels(discordClient, guildId, view) {
    return dashboardRenderer.getPlayerLabels(discordClient, guildId, view)
  }

  async function ensureStorytellerDashboardReady(interaction) {
    const context = await createDashboardContext({
      interaction,
      serverConfigs,
      isSetupComplete,
      createSetupRequiredMessage,
      ensureConfiguredServerReady,
      gameLifecycle
    })

    if (context.ok) attachStatusUpdater(interaction, context)
    return context
  }

  function attachStatusUpdater(interaction, context) {
    if (interaction.channelId !== context.serverConfig.storytellerChannelId) return

    interaction.botcUpdateDashboardStatus = (title, description, color) =>
      dashboardStatus.update(interaction, context.serverConfig, title, description, color)
    interaction.botcUpdateDashboardPayload = payload =>
      dashboardStatus.updatePayload(interaction, context.serverConfig, payload)
    interaction.botcClearDashboardStatus = () =>
      dashboardStatus.clearStatusMessage(interaction, context.serverConfig)
  }

  const handleDashboardLifecycleResult = createDashboardLifecycleResultHandler({
    clearStorytellerDashboardState,
    dashboardState,
    postOrUpdateStorytellerDashboard,
    services
  })
  const handleStorytellerDashboardButton = createStorytellerDashboardButtonHandler({
    dashboardState,
    ensureStorytellerDashboardReady,
    gameLifecycle,
    gameManager,
    getDashboardPlayerLabels: dashboardRenderer.getPlayerLabels,
    handleDashboardLifecycleResult,
    clearDashboardStatus: dashboardStatus.clearStatusMessage,
    saveServerConfigs,
    serverConfigs,
    services,
    postOrUpdateStorytellerDashboard
  })
  registerRuntimeMaintenanceTask('storytellerDashboardButtonFlight', ({ now }) =>
    handleStorytellerDashboardButton.getRuntimeState({ now }))
  const handleStorytellerDashboardSelect = createStorytellerDashboardSelectHandler({
    dashboardState,
    ensureStorytellerDashboardReady,
    gameLifecycle,
    getDashboardPlayerLabels: dashboardRenderer.getPlayerLabels,
    handleDashboardLifecycleResult,
    playerActions,
    services,
    postOrUpdateStorytellerDashboard
  })
  const handleStorytellerDashboardModal = createStorytellerDashboardModalHandler({
    dashboardState,
    ensureStorytellerDashboardReady,
    gameLifecycle,
    handleDashboardLifecycleResult,
    services
  })

  async function handleStorytellerDashboardInteraction(interaction) {
    if (interaction.isModalSubmit()) {
      return handleStorytellerDashboardModal(interaction)
    }

    if (interaction.isStringSelectMenu()) {
      return handleStorytellerDashboardSelect(interaction)
    }

    if (interaction.isButton()) {
      return handleStorytellerDashboardButton(interaction)
    }
  }

  return {
    clearStorytellerDashboardState,
    getDashboardPlayerLabels,
    handleStorytellerDashboardInteraction,
    postOrUpdateStorytellerDashboard,
    registerStorytellerDashboardRefresh
  }
}

function getActiveGameGuildIds(gameLifecycle) {
  const games = gameLifecycle?.gameManager?.games
  if (typeof games?.keys === 'function') return [...games.keys()]
  return []
}

module.exports = {
  createStorytellerDashboardSystem
}
