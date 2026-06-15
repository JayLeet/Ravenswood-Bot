const {
  CLEAR_ROLE_VALUE,
  STORYTELLER_DASHBOARD_ACTIONS,
  STORYTELLER_PLAYER_ACTIONS,
  createReminderModal,
  createRolePanelPayload,
  createSecretInfoModal,
  formatRoleName,
  getLatestSuggestedInfo,
  parseForcedNominationCustomId,
  parseNominationNominatorCustomId,
  parseRoleSelectCustomId
} = require('../../embeds')
const {
  acknowledgeInteraction,
  editDashboardFailure,
  showInteractionModal
} = require('../feedback')
const {
  DRUNK_ROLE_ID
} = require('../../../game/roles/setupCounts')
const {
  formatDashboardPlayer
} = require('./fakePlayers')
const {
  handleActionSelect,
  handleForcedNominationSelect,
  handleNominationNominatorSelect
} = require('./actionSelects')
const {
  sendQuickInfoResponse
} = require('./quickInfo')
const {
  handleNominationBuilderSelect
} = require('./nominationBuilderSelects')
const {
  deferIfNoStatusUpdater
} = require('./buttonHandler')
const {
  updateControlPayload
} = require('./randomRoleButton')

function createStorytellerDashboardSelectHandler({
  dashboardState,
  ensureStorytellerDashboardReady,
  gameLifecycle,
  getDashboardPlayerLabels,
  handleDashboardLifecycleResult,
  playerActions,
  services,
  postOrUpdateStorytellerDashboard
}) {
  return async function handleStorytellerDashboardSelect(interaction) {
    if (isModalAction(interaction)) {
      const context = await ensureStorytellerDashboardReady(interaction)
      if (!context.ok) return editDashboardFailure(interaction, context)
      return showSelectedPlayerModal(interaction, context, dashboardState)
    }

    const context = await ensureStorytellerDashboardReady(interaction)
    if (!context.ok) return editDashboardFailure(interaction, context)
    await deferIfNoStatusUpdater(interaction)

    const nominationBuilderResult = await handleNominationBuilderSelect(interaction, context, {
      dashboardState,
      getDashboardPlayerLabels
    })
    if (nominationBuilderResult) return nominationBuilderResult

    if (isStaleRandomRoleSelect(interaction.customId)) {
      return editDashboardFailure(interaction, {
        title: 'Unknown control',
        message: 'That dashboard dropdown is not recognized.',
        suggestion: 'Refresh the dashboard and try again.'
      })
    }

    const forcedNomination = parseForcedNominationCustomId(interaction.customId)
    if (forcedNomination) {
      return handleForcedNominationSelect(interaction, context, {
        gameLifecycle,
        handleDashboardLifecycleResult,
        nominatorId: forcedNomination.nominatorId
      })
    }

    const nominationNominator = parseNominationNominatorCustomId(interaction.customId)
    if (nominationNominator) {
      return handleNominationNominatorSelect(interaction, context, {
        gameLifecycle,
        handleDashboardLifecycleResult,
        nominatorId: nominationNominator.nomineeId
      })
    }

    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.player) {
      return handlePlayerSelect(interaction, context, { dashboardState, postOrUpdateStorytellerDashboard })
    }

    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.script) {
      return handleScriptSelect(interaction, context, { gameLifecycle, handleDashboardLifecycleResult })
    }

    const playerId = dashboardState.getSelectedPlayer(interaction.guild.id, interaction.member.id)
    if (!playerId) return editSelectPlayerFirst(interaction)

    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.drunkShownRole) {
      return handleDrunkShownRoleSelect(interaction, context, { gameLifecycle, handleDashboardLifecycleResult, playerId })
    }

    if (parseRoleSelectCustomId(interaction.customId) || interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.role) {
      return handleRoleSelect(interaction, context, { gameLifecycle, getDashboardPlayerLabels, handleDashboardLifecycleResult, playerId })
    }

    if (isQuickInfoSelect(interaction.customId)) {
      return handleQuickInfoSelect(interaction, context, { gameLifecycle, handleDashboardLifecycleResult, playerId, services })
    }

    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.action) {
      return handleActionSelect(interaction, context, {
        getDashboardPlayerLabels,
        handleDashboardLifecycleResult,
        interaction,
        playerActions,
        playerId
      })
    }

    return editDashboardFailure(interaction, {
      title: 'Unknown control',
      message: 'That dashboard dropdown is not recognized.',
      suggestion: 'Refresh the dashboard and try again.'
    })
  }
}

function isModalAction(interaction) {
  return interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.action &&
    [STORYTELLER_PLAYER_ACTIONS.addReminder, STORYTELLER_PLAYER_ACTIONS.secretInfo]
      .includes(interaction.values[0])
}

function showSelectedPlayerModal(interaction, context, dashboardState) {
  const playerId = dashboardState.getSelectedPlayer(interaction.guild.id, interaction.member.id)
  if (!playerId) return editDashboardFailure(interaction, createSelectPlayerFirstError())

  return showInteractionModal(
    interaction,
    interaction.values[0] === STORYTELLER_PLAYER_ACTIONS.addReminder
      ? createReminderModal()
      : createSecretInfoModal(getLatestSuggestedInfo(context.view, playerId))
  )
}

async function handlePlayerSelect(interaction, context, deps) {
  const { dashboardState, postOrUpdateStorytellerDashboard } = deps
  const playerId = interaction.values[0]

  if (!context.view.users.players.includes(playerId)) {
    return editDashboardFailure(interaction, {
      title: 'Player not found',
      message: 'That player is not in the current game anymore.',
      suggestion: 'Refresh the dashboard and choose another player.'
    })
  }

  dashboardState.setSelectedPlayer(interaction.guild.id, interaction.member.id, playerId)
  await postOrUpdateStorytellerDashboard(interaction.client, interaction.guild.id, playerId)
  return acknowledgeInteraction(interaction)
}

async function handleScriptSelect(interaction, context, deps) {
  const result = await deps.gameLifecycle.setScript(interaction.guild.id, interaction.member, interaction.values[0])
  return deps.handleDashboardLifecycleResult(
    interaction,
    context,
    result,
    result.ok ? `Script set to ${result.script.name}.` : null
  )
}

async function handleRoleSelect(interaction, context, deps) {
  const { gameLifecycle, getDashboardPlayerLabels, handleDashboardLifecycleResult, playerId } = deps
  const roleId = interaction.values[0]
  const result = roleId === CLEAR_ROLE_VALUE
    ? await gameLifecycle.clearScriptRole(interaction.guild.id, interaction.member, playerId)
    : await gameLifecycle.assignScriptRole(interaction.guild.id, interaction.member, playerId, roleId)
  const playerLabel = formatDashboardPlayer(context, playerId)

  if (result.ok && roleId === DRUNK_ROLE_ID) {
    const labels = await getDashboardPlayerLabels(interaction.client, interaction.guild.id, result.view)
    return updateControlPayload(interaction, createRolePanelPayload(result.view, playerId, labels))
  }

  return handleDashboardLifecycleResult(
    interaction,
    context,
    result,
    result.ok ? formatRoleSelectMessage(roleId, result, playerLabel) : null
  )
}

function formatRoleSelectMessage(roleId, result, playerLabel) {
  if (roleId === CLEAR_ROLE_VALUE) return `Cleared the role for ${playerLabel}.`
  return `Assigned ${result.roleName || formatRoleName(roleId)} to ${playerLabel}.`
}

async function handleDrunkShownRoleSelect(interaction, context, deps) {
  const result = await deps.gameLifecycle.setDrunkShownRole(
    interaction.guild.id,
    interaction.member,
    deps.playerId,
    interaction.values[0]
  )

  return deps.handleDashboardLifecycleResult(
    interaction,
    context,
    result,
    result.ok ? `Updated what ${formatDashboardPlayer(context, deps.playerId)} thinks they are to ${result.shownRoleName}.` : null
  )
}

async function handleQuickInfoSelect(interaction, context, deps) {
  const text = getQuickSelectText(interaction, context)
  const { result, message } = await sendQuickInfoResponse({
    interaction,
    context,
    gameLifecycle: deps.gameLifecycle,
    services: deps.services,
    playerId: deps.playerId,
    text
  })
  return deps.handleDashboardLifecycleResult(interaction, context, result, message)
}

function editSelectPlayerFirst(interaction) {
  return editDashboardFailure(interaction, createSelectPlayerFirstError())
}

function createSelectPlayerFirstError() {
  return {
    title: 'Select a player',
    message: 'Choose a player from the dashboard first.',
    suggestion: 'Use the player dropdown, then choose this control again.'
  }
}

function isQuickInfoSelect(customId) {
  return [
    STORYTELLER_DASHBOARD_ACTIONS.quickNumber,
    STORYTELLER_DASHBOARD_ACTIONS.quickPlayer,
    STORYTELLER_DASHBOARD_ACTIONS.quickCharacter
  ].includes(customId)
}

function isStaleRandomRoleSelect(customId) {
  const randomRolePrefix = `${STORYTELLER_DASHBOARD_ACTIONS.randomRolesSelect}:`
  return customId === STORYTELLER_DASHBOARD_ACTIONS.randomRolesDrunkShownSelect ||
    String(customId || '').startsWith(randomRolePrefix)
}

function getQuickSelectText(interaction, context) {
  const value = interaction.values[0]
  if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.quickPlayer) return formatDashboardPlayer(context, value)
  if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.quickCharacter) return context.view.engine.roleNames?.[value] || formatRoleName(value)
  return value
}

module.exports = {
  createStorytellerDashboardSelectHandler,
  getQuickSelectText,
  handleDrunkShownRoleSelect,
  handlePlayerSelect,
  handleQuickInfoSelect,
  handleRoleSelect,
  isStaleRandomRoleSelect
}
