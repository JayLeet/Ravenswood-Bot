const {
  parseStorytellerAdvanceCustomId,
  STORYTELLER_DASHBOARD_ACTIONS
} = require('../../embeds')
const {
  editDashboardFailure
} = require('../feedback')
const {
  createNominationsOpenedMessage
} = require('../../../../utils/nominationRequests')
const {
  appendPrivateVoiceFeatureNotice,
  createPrivateVoiceFeatureComponents
} = require('../../../../utils/privateVoiceNotice')

function createAdvanceButtonHandler({
  gameLifecycle,
  handleDashboardLifecycleResult
}) {
  return async function handleAdvanceButton(interaction, context) {
    const advanceState = parseStorytellerAdvanceCustomId(interaction.customId)
    if (interaction.customId !== STORYTELLER_DASHBOARD_ACTIONS.advance && !advanceState) {
      return null
    }

    if (advanceState && isStaleAdvanceClick(advanceState, context.view)) {
      return editDashboardFailure(interaction, {
        title: 'Dashboard changed',
        message: 'That phase button is from an older dashboard state.',
        suggestion: 'Refresh the dashboard, then use the current phase button.'
      })
    }

    const result = context.view.state === 'lobby'
      ? await gameLifecycle.startGame(interaction.guild.id, interaction.member)
      : await gameLifecycle.advancePhase(interaction.guild.id, interaction.member)

    return handleDashboardLifecycleResult(
      interaction,
      context,
      result,
      createAdvanceStatusMessage(result),
      createAdvanceLiveNotice(result)
    )
  }
}

function createAdvanceStatusMessage(result) {
  if (!result.ok) return null
  if (result.ended) return null
  if (result.view) return `Game started. Current phase: ${result.view.phaseLabel}.`
  return `Advanced to ${result.phaseLabel}.`
}

function createAdvanceLiveMessage(result) {
  return createAdvanceLiveNotice(result)?.message || null
}

function createAdvanceLiveNotice(result) {
  if (!result.ok || result.ended) return null
  const phaseMessage = createPhaseLiveMessage(result)
  const message = result.publicMessage
    ? [result.publicMessage, phaseMessage].filter(Boolean).join('\n')
    : phaseMessage
  return {
    components: createPrivateVoiceFeatureComponents(getAdvanceNoticePhase(result)),
    message
  }
}

function createPhaseLiveMessage(result) {
  if (result.view) return appendPrivateVoiceFeatureNotice(`The game has started. Current phase: ${result.view.phaseLabel}.`, result.view.phase)
  if (result.phase === 'nominations') return appendPrivateVoiceFeatureNotice(createNominationsOpenedMessage(), result.phase)
  if (!result.phaseLabel) return null
  return appendPrivateVoiceFeatureNotice(`The game advanced to ${result.phaseLabel}.`, result.phase)
}

function getAdvanceNoticePhase(result) {
  return result.view?.phase || result.phase || null
}

function isStaleAdvanceClick(expected, view) {
  return expected.state !== view.state || expected.phase !== view.phase || expected.day !== (view.day || 0)
}

module.exports = {
  createAdvanceButtonHandler,
  createAdvanceLiveMessage,
  createAdvanceLiveNotice,
  createAdvanceStatusMessage,
  createPhaseLiveMessage,
  isStaleAdvanceClick
}
