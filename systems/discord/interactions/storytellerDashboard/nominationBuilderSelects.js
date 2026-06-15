const {
  STORYTELLER_DASHBOARD_ACTIONS,
  createNominationBuilderPayload
} = require('../../embeds')
const {
  editDashboardFailure
} = require('../feedback')
const {
  updateControlPayload
} = require('./randomRoleButton')

async function handleNominationBuilderSelect(interaction, context, deps) {
  const draftKey = getDraftKey(interaction.customId)
  if (!draftKey) return null

  const playerId = interaction.values[0]
  if (!isCurrentPlayer(context.view, playerId)) {
    return editDashboardFailure(interaction, {
      title: 'Player not found',
      message: 'That player is not in the current game anymore.',
      suggestion: 'Open Nominate again and choose a current player.'
    })
  }

  const draft = deps.dashboardState.setNominationDraftChoice(
    interaction.guild.id,
    interaction.member.id,
    draftKey,
    playerId
  )
  const labels = await deps.getDashboardPlayerLabels(interaction.client, interaction.guild.id, context.view)
  return updateControlPayload(interaction, createNominationBuilderPayload(context.view, draft, labels))
}

function getDraftKey(customId) {
  if (customId === STORYTELLER_DASHBOARD_ACTIONS.nominationBuilderNominator) return 'nominatorId'
  if (customId === STORYTELLER_DASHBOARD_ACTIONS.nominationBuilderNominee) return 'nomineeId'
  return null
}

function isCurrentPlayer(view, playerId) {
  return (view.users.players || []).includes(playerId)
}

module.exports = {
  getDraftKey,
  handleNominationBuilderSelect,
  isCurrentPlayer
}
