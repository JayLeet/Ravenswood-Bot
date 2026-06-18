const {
  editDashboardLifecycleFailure,
  editDashboardSuccess
} = require('../feedback')
const {
  editRevealBoardFailure,
  postGrimRevealBoard,
  rollbackUnpostedReveal
} = require('./revealBoardPosting')

async function handleOpenEndReveal(interaction, context, deps) {
  const { gameLifecycle, gameManager, getDashboardPlayerLabels, handleDashboardLifecycleResult } = deps
  const result = await gameLifecycle.openEndReveal(interaction.guild.id, interaction.member)
  if (!result.ok) return editDashboardLifecycleFailure(interaction, result)
  if (result.ended) return handleDashboardLifecycleResult(interaction, context, result)

  const labels = await getDashboardPlayerLabels(interaction.client, interaction.guild.id, result.view)
  const posted = await postGrimRevealBoard({
    cleanupExisting: !result.revealAlreadyOpen,
    existingMessageRef: result.reveal,
    failureMessage: 'The game-ending reveal was prepared, but I could not post the public Grim reveal board.',
    failureSuggestion: 'Check my post-game channel permissions, then press End Game again.',
    gameManager,
    interaction,
    labels,
    revealId: result.reveal.id,
    serverConfig: context.serverConfig,
    view: result.view
  })
  if (!posted.ok) {
    if (!result.revealAlreadyOpen) {
      await rollbackUnpostedReveal(gameLifecycle, interaction, result.reveal.id)
    }
    return editRevealBoardFailure(interaction, posted)
  }

  trackRevealBoardMessage(result.reveal, posted.message, gameLifecycle)
  return editDashboardSuccess(
    interaction,
    result.revealAlreadyOpen
      ? 'Public Grim reveal board reopened. Continue revealing hidden roles there.'
      : 'Public Grim reveal board posted. Reveal at least one role before choosing a winner.'
  )
}

function trackRevealBoardMessage(reveal, message, gameLifecycle) {
  if (!reveal || !message?.id) return
  reveal.boardChannelId = message.channelId || message.channel?.id || reveal.boardChannelId || null
  reveal.boardMessageId = message.id
  gameLifecycle.save?.()
}

module.exports = {
  handleOpenEndReveal,
  trackRevealBoardMessage
}
