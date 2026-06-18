const {
  createSecretInfoModal,
  createTimerModal,
  getLatestSuggestedInfo,
  parseQuickTextCustomId,
  STORYTELLER_DASHBOARD_ACTIONS
} = require('../../embeds')
const {
  acknowledgeInteraction,
  createSystemEmbed,
  editDashboardFailure,
  editDashboardLifecycleFailure,
  editDashboardSuccess,
  showInteractionModal
} = require('../feedback')
const {
  setPostGameStorytellerView
} = require('../../phaseChannelPermissions')
const { createSingleFlight } = require('../../../../utils/discord/singleFlight')
const { runDashboardButtonFlight } = require('./buttonFlight')
const {
  createUnsupportedDashboardControlFailure,
  normalizeDashboardButtonCustomId,
  reportUnsupportedDashboardControl
} = require('./controlAudit')
const { createAdvanceButtonHandler } = require('./advanceButton')
const { handleEndRevealChoice } = require('./endRevealChoice')
const { parseEndRevealCustomId } = require('./endGameReveal')
const { guardExternalMode } = require('./externalModeGuard')
const { createForcedNominationButtonHandler } = require('./forcedNominationButton')
const { createGongButtonHandler } = require('./gongButton')
const { createGrimRevealButtonHandler } = require('./grimRevealButton')
const { createGrimoireButtonHandler } = require('./grimoireButton')
const { handleOpenEndReveal } = require('./endRevealOpen')
const { createMoveButtonHandler } = require('./moveButtons')
const { createNightOrderButtonHandler } = require('./nightOrderButtons')
const { createNominationRequestButtonHandler } = require('./nominationRequestButton')
const { createPlayerControlButtonHandler } = require('./playerControlButtons')
const { handleRefresh } = require('./refreshButton')
const { sendQuickInfoResponse } = require('./quickInfo')
const { createRandomRoleButtonHandler } = require('./randomRoleButton')
const { createRoleButtonHandler } = require('./roleButtons')
const { createVotingControlButtonHandler } = require('./votingControlButtons')
const { formatVotingLogForDay } = require('../../../../utils/storytellerDashboard/votingLogs')
const { createRequestDecisionRows } = require('../../../../utils/requestDecisionButtons')
const RESUME_BUTTON_ID = 'botc:storyteller:resume'

function createStorytellerDashboardButtonHandler(deps) {
  const {
    dashboardState,
    deletePendingGameSummary,
    ensureStorytellerDashboardReady,
    getDashboardPlayerLabels,
    gameLifecycle,
    gameManager,
    handleDashboardLifecycleResult,
    clearDashboardStatus,
    saveServerConfigs,
    serverConfigs,
    services,
    postOrUpdateStorytellerDashboard
  } = deps
  const dashboardButtonFlight = createSingleFlight()
  const handleAdvanceButton = createAdvanceButtonHandler({ gameLifecycle, handleDashboardLifecycleResult })
  const handleForcedNominationButton = createForcedNominationButtonHandler({ dashboardState, gameLifecycle, getDashboardPlayerLabels, handleDashboardLifecycleResult })
  const handleGongButton = createGongButtonHandler({ gameLifecycle })
  const handleGrimRevealButton = createGrimRevealButtonHandler({
    deletePendingGameSummary,
    gameLifecycle,
    getDashboardPlayerLabels,
    serverConfigs
  })
  const handleGrimoireButton = createGrimoireButtonHandler({
    clearDashboardStatus,
    gameLifecycle,
    gameManager,
    getDashboardPlayerLabels,
    handleDashboardLifecycleResult,
    postOrUpdateStorytellerDashboard,
    services
  })
  const handleMoveButton = createMoveButtonHandler({ dashboardState, getDashboardPlayerLabels, services })
  const handleNightOrderButton = createNightOrderButtonHandler({ gameLifecycle, getDashboardPlayerLabels, saveServerConfigs, serverConfigs, services, postOrUpdateStorytellerDashboard })
  const handleNominationRequestButton = createNominationRequestButtonHandler({ gameLifecycle, handleDashboardLifecycleResult })
  const handlePlayerControlButton = createPlayerControlButtonHandler({
    dashboardState,
    gameLifecycle,
    getDashboardPlayerLabels,
    handleDashboardLifecycleResult,
    postOrUpdateStorytellerDashboard
  })
  const handleRoleButton = createRoleButtonHandler({ dashboardState, gameLifecycle, getDashboardPlayerLabels, handleDashboardLifecycleResult })
  const handleRandomRoleButton = createRandomRoleButtonHandler({ dashboardState, gameLifecycle, handleDashboardLifecycleResult })
  const handleVotingControlButton = createVotingControlButtonHandler({ gameLifecycle, handleDashboardLifecycleResult })

  async function handleStorytellerDashboardButton(interaction) {
    return runDashboardButtonFlight(interaction, dashboardButtonFlight, async () => {
      normalizeDashboardButtonCustomId(interaction)
      if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.quickCustom) return handleQuickCustom(interaction, deps)

      const context = await ensureStorytellerDashboardReady(interaction)
      if (!context.ok) return editDashboardFailure(interaction, context)
      if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.statusDismiss) {
        await acknowledgeInteraction(interaction)
        return clearDashboardStatus?.(interaction, context.serverConfig)
      }

      const paused = guardPausedReplacement(interaction, context)
      if (paused) return paused

      const externalBlocked = guardExternalMode(interaction, context)
      if (externalBlocked) return externalBlocked

      if (interaction.customId === RESUME_BUTTON_ID) return handleResume(interaction, context, { gameLifecycle, handleDashboardLifecycleResult })
      if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.timer) return showInteractionModal(interaction, createTimerModal())

      const reveal = parseEndRevealCustomId(interaction.customId)
      if (reveal) {
        return handleEndRevealChoice(interaction, context, reveal, {
          gameLifecycle,
          gameManager,
          getDashboardPlayerLabels,
          deletePendingGameSummary,
          serverConfigs,
          setPostGameStorytellerView
        })
      }

      const earlyResult = await tryEarlyHandlers(interaction, context, {
        handleForcedNominationButton,
        handleGongButton,
        handleGrimRevealButton,
        handleNightOrderButton
      })
      if (earlyResult) return earlyResult

      const advanceResult = await handleAdvanceButton(interaction, context)
      if (advanceResult) return advanceResult

      await deferIfNoStatusUpdater(interaction)

      const standardResult = await tryStandardHandlers(interaction, context, {
        handleGrimoireButton,
        handleMoveButton,
        handleNominationRequestButton,
        handlePlayerControlButton,
        handleRandomRoleButton,
        handleRoleButton,
        handleVotingControlButton
      })
      if (standardResult) return standardResult

      const quickText = parseQuickTextCustomId(interaction.customId)
      if (quickText) return handleQuickText(interaction, context, quickText, { dashboardState, gameLifecycle, services, handleDashboardLifecycleResult })

      if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.refresh) return handleRefresh(interaction, context, { dashboardState, postOrUpdateStorytellerDashboard, services })
      if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.requests) return handleRequests(interaction, gameLifecycle)
      if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.votingLogs) return handleVotingLogs(interaction, context, gameLifecycle, getDashboardPlayerLabels)

      if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.end) {
        return handleOpenEndReveal(interaction, context, { gameLifecycle, gameManager, getDashboardPlayerLabels, handleDashboardLifecycleResult })
      }

      reportUnsupportedDashboardControl(interaction, 'button')
      return editDashboardFailure(interaction, createUnsupportedDashboardControlFailure('button'))
    })
  }
  handleStorytellerDashboardButton.getRuntimeState = (...args) => dashboardButtonFlight.getRuntimeState(...args)
  return handleStorytellerDashboardButton
}

function guardPausedReplacement(interaction, context) {
  if (!context.view?.paused && !context.game?.paused) return null
  if ([
    STORYTELLER_DASHBOARD_ACTIONS.requests,
    STORYTELLER_DASHBOARD_ACTIONS.end,
    RESUME_BUTTON_ID
  ].includes(interaction.customId)) return null
  return editDashboardFailure(interaction, {
    title: 'Game paused',
    message: `<@${context.view?.storytellerId || interaction.member.id}> A replacement player is needed before the game can continue.`,
    suggestion: 'Open Requests, approve a join request, Resume, or End Game.'
  })
}

async function tryEarlyHandlers(interaction, context, handlers) {
  return await handlers.handleForcedNominationButton(interaction, context) ||
    await handlers.handleGongButton(interaction, context) ||
    await handlers.handleGrimRevealButton(interaction, context) ||
    await handlers.handleNightOrderButton(interaction, context)
}

async function tryStandardHandlers(interaction, context, handlers) {
  return await handlers.handleGrimoireButton(interaction, context) ||
    await handlers.handleMoveButton(interaction, context) ||
    await handlers.handleVotingControlButton(interaction, context) ||
    await handlers.handlePlayerControlButton(interaction, context) ||
    await handlers.handleNominationRequestButton(interaction, context) ||
    await handlers.handleRoleButton(interaction, context) ||
    await handlers.handleRandomRoleButton(interaction, context)
}

async function deferIfNoStatusUpdater(interaction) {
  return acknowledgeInteraction(interaction)
}

async function handleQuickCustom(interaction, { dashboardState, ensureStorytellerDashboardReady }) {
  const context = await ensureStorytellerDashboardReady(interaction)
  if (!context.ok) return editDashboardFailure(interaction, context)

  const playerId = dashboardState.getSelectedPlayer(interaction.guild.id, interaction.member.id)
  if (!playerId) return editDashboardFailure(interaction, {
    title: 'Choose a player first',
    message: 'Choose a player first.',
    suggestion: 'Use the player dropdown, then open Custom info again.'
  })

  return showInteractionModal(interaction, createSecretInfoModal(getLatestSuggestedInfo(context.view, playerId)))
}

async function handleQuickText(interaction, context, quickText, deps) {
  const { dashboardState, gameLifecycle, services, handleDashboardLifecycleResult } = deps
  const playerId = dashboardState.getSelectedPlayer(interaction.guild.id, interaction.member.id)
  if (!playerId) {
    return editDashboardFailure(interaction, {
      title: 'Select a player',
      message: 'Choose a player from the dashboard first.',
      suggestion: 'Use the player dropdown, then open Quick info again.'
    })
  }

  const { result, message } = await sendQuickInfoResponse({ interaction, context, gameLifecycle, services, playerId, text: quickText })
  return handleDashboardLifecycleResult(interaction, context, result, message)
}

async function handleRequests(interaction, gameLifecycle) {
  const result = gameLifecycle.getPendingRequestsForStoryteller(interaction.guild.id, interaction.member)
  if (!result.ok) return editDashboardLifecycleFailure(interaction, result)
  const message = result.requests.length
    ? result.requests.map(req => `ID: ${req.id}\nUser: <@${req.userId}>\nType: ${req.type}`).join('\n\n')
    : 'There are no pending requests.'

  if (result.requests.length && typeof interaction.botcUpdateDashboardPayload === 'function') {
    await interaction.botcUpdateDashboardPayload({
      embeds: [createSystemEmbed('Requests', message, 0x3498db)],
      components: createRequestDecisionRows(result.requests)
    })
    return acknowledgeInteraction(interaction)
  }

  return editDashboardSuccess(interaction, message)
}

async function handleVotingLogs(interaction, context, gameLifecycle, getDashboardPlayerLabels) {
  const entries = gameLifecycle.getCurrentDayVotingLog(context.game)
  const labels = await getDashboardPlayerLabels(interaction.client, interaction.guild.id, context.view)
  return editDashboardSuccess(interaction, formatVotingLogForDay(context.view.day || 1, entries, labels))
}

async function handleResume(interaction, context, deps) {
  const result = await deps.gameLifecycle.session.resumeGame(deps.gameLifecycle, interaction.guild.id, interaction.member)
  return deps.handleDashboardLifecycleResult(
    interaction,
    context,
    result,
    result.ok ? 'The paused game was resumed.' : null
  )
}

module.exports = {
  RESUME_BUTTON_ID,
  createStorytellerDashboardButtonHandler,
  deferIfNoStatusUpdater,
  guardPausedReplacement,
  handleQuickText,
  handleRequests,
  handleVotingLogs
}
