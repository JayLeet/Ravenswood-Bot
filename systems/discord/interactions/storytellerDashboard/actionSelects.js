const {
  STORYTELLER_PLAYER_ACTIONS,
  createNominationNominatorPayload,
  createQuickInfoPayload
} = require('../../embeds')
const {
  updateControlPayload
} = require('./randomRoleButton')
const {
  formatDashboardPlayer
} = require('./fakePlayers')
const {
  runPlayerChoice
} = require('./playerChoiceSelect')

async function handleActionSelect(interaction, context, deps) {
  const { getDashboardPlayerLabels, handleDashboardLifecycleResult, playerActions, playerId } = deps
  const action = interaction.values[0]

  if (action === STORYTELLER_PLAYER_ACTIONS.quickInfo) {
    const playerLabels = await getDashboardPlayerLabels(interaction.client, interaction.guild.id, context.view)
    return updateControlPayload(
      interaction,
      createQuickInfoPayload(context.view, playerId, playerLabels)
    )
  }

  if (action === STORYTELLER_PLAYER_ACTIONS.nominateByPlayer) {
    const playerLabels = await getDashboardPlayerLabels(interaction.client, interaction.guild.id, context.view)
    return updateControlPayload(
      interaction,
      createNominationNominatorPayload(context.view, playerId, playerLabels)
    )
  }

  const { result, message, liveMessage } = await playerActions.run(interaction, context, action, playerId)
  return handleDashboardLifecycleResult(interaction, context, result, message, liveMessage)
}

async function handleForcedNominationSelect(interaction, context, deps) {
  const nomineeId = interaction.values[0]
  const result = await deps.gameLifecycle.forceStorytellerNomination(
    interaction.guild.id,
    interaction.member,
    deps.nominatorId,
    nomineeId
  )
  const message = result.ok ? formatNominationMessage(context, deps.nominatorId, nomineeId) : null
  return deps.handleDashboardLifecycleResult(interaction, context, result, message, null)
}

async function handleNominationNominatorSelect(interaction, context, deps) {
  const { result, nominatorId, nomineeId } = await runPlayerChoice(interaction, deps)
  const message = result.ok ? formatNominationMessage(context, nominatorId, nomineeId) : null
  return deps.handleDashboardLifecycleResult(interaction, context, result, message, null)
}

function formatNominationMessage(context, nominatorId, nomineeId) {
  return `${formatDashboardPlayer(context, nominatorId)} has nominated ${formatDashboardPlayer(context, nomineeId)}.`
}

module.exports = {
  handleActionSelect,
  handleForcedNominationSelect,
  handleNominationNominatorSelect
}
