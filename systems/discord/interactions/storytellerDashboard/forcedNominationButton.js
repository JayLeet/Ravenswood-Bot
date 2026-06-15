const {
  createNominationBuilderPayload,
  parseForcedNominationCustomId,
  STORYTELLER_DASHBOARD_ACTIONS
} = require('../../embeds')
const {
  editDashboardFailure
} = require('../feedback')
const {
  formatDashboardPlayer
} = require('./fakePlayers')
const {
  updateControlPayload
} = require('./randomRoleButton')

function createForcedNominationButtonHandler({
  dashboardState,
  gameLifecycle,
  getDashboardPlayerLabels,
  handleDashboardLifecycleResult
}) {
  return async function handleForcedNominationButton(interaction, context) {
    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.nominationBuilderConfirm) {
      return handleNominationConfirm(interaction, context, {
        dashboardState,
        gameLifecycle,
        handleDashboardLifecycleResult
      })
    }

    const parsed = parseForcedNominationCustomId(interaction.customId)
    if (interaction.customId !== STORYTELLER_DASHBOARD_ACTIONS.forcedNomination && !parsed) return null

    if (context.view.phase !== 'nominations') {
      return editDashboardFailure(interaction, {
        title: 'Nominations only',
        message: 'Storyteller nominations are only available during nominations.',
        suggestion: 'Advance to nominations, then try Nominate again.'
      })
    }

    const players = context.view.users.players || []
    if (!players.length) {
      return editDashboardFailure(interaction, {
        title: 'No players',
        message: 'There are no players available to nominate.',
        suggestion: 'Add players to the game, then press Nominate again.'
      })
    }

    const draft = dashboardState.setNominationDraft(
      interaction.guild.id,
      interaction.member.id,
      createInitialNominationDraft(interaction, context, parsed, dashboardState)
    )
    const labels = await getDashboardPlayerLabels(interaction.client, interaction.guild.id, context.view)
    return updateControlPayload(
      interaction,
      createNominationBuilderPayload(context.view, draft, labels)
    )
  }
}

function createInitialNominationDraft(interaction, context, parsed, dashboardState) {
  const players = context.view.users.players || []
  const parsedId = parsed?.nominatorId
  const selectedId = dashboardState.getSelectedPlayer(interaction.guild.id, interaction.member.id)
  const nominatorId = players.includes(parsedId)
    ? parsedId
    : players.includes(selectedId)
      ? selectedId
      : null
  return { nominatorId, nomineeId: null }
}

async function handleNominationConfirm(interaction, context, deps) {
  const { dashboardState, gameLifecycle, handleDashboardLifecycleResult } = deps
  const draft = dashboardState.getNominationDraft(interaction.guild.id, interaction.member.id)
  const validation = validateNominationDraft(context.view, draft)

  if (!validation.ok) {
    return editDashboardFailure(interaction, validation)
  }

  const result = await gameLifecycle.forceStorytellerNomination(
    interaction.guild.id,
    interaction.member,
    draft.nominatorId,
    draft.nomineeId
  )
  if (result.ok) dashboardState.clearNominationDraft(interaction.guild.id, interaction.member.id)

  const message = result.ok
    ? `${formatDashboardPlayer(context, draft.nominatorId)} has nominated ${formatDashboardPlayer(context, draft.nomineeId)}.`
    : null
  return handleDashboardLifecycleResult(interaction, context, result, message, null)
}

function validateNominationDraft(view, draft = {}) {
  const players = view.users.players || []
  if (!draft.nominatorId || !draft.nomineeId) {
    return {
      ok: false,
      title: 'Choose both players',
      message: 'Pick both the nominator and the nominee before confirming.',
      suggestion: 'Use the two dropdowns, then press Confirm Nomination.'
    }
  }

  if (!players.includes(draft.nominatorId) || !players.includes(draft.nomineeId)) {
    return {
      ok: false,
      title: 'Player not found',
      message: 'One of the selected players is no longer in the game.',
      suggestion: 'Open Nominate again and choose current players.'
    }
  }

  return { ok: true }
}

module.exports = {
  createInitialNominationDraft,
  createForcedNominationButtonHandler,
  validateNominationDraft
}
