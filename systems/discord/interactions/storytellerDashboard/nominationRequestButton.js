const {
  editDashboardFailure
} = require('../feedback')
const {
  parseNominationRequestCustomId
} = require('../../embeds')

function createNominationRequestButtonHandler({
  gameLifecycle,
  handleDashboardLifecycleResult
}) {
  return async function handleNominationRequestButton(interaction, context) {
    const parsed = parseNominationRequestCustomId(interaction.customId)
    if (!parsed) return null

    const method = getNominationRequestMethod(parsed.action)
    if (!method || !parsed.requestId) {
      return editDashboardFailure(interaction, {
        title: 'Unknown nomination action',
        message: 'That nomination request button is not recognized.',
        suggestion: 'Refresh the dashboard and try again.'
      })
    }

    const result = await gameLifecycle[method](interaction.guild.id, interaction.member, parsed.requestId)
    const message = getNominationRequestResultMessage(parsed.action, result)
    return handleDashboardLifecycleResult(interaction, context, result, result.ok ? message : null)
  }
}

function getNominationRequestMethod(action) {
  return {
    approve: 'approveNominationRequest',
    reject: 'rejectNominationRequest',
    cancel: 'cancelNominationRequest'
  }[action]
}

function getNominationRequestResultMessage(action, result) {
  if (action === 'approve') {
    return `Approved nomination: <@${result.request.nominatorId}> → <@${result.request.nomineeId}>.`
  }
  if (action === 'reject') return 'Rejected the nomination request.'
  return 'Cancelled the nomination request.'
}

module.exports = {
  createNominationRequestButtonHandler,
  getNominationRequestMethod,
  getNominationRequestResultMessage
}
