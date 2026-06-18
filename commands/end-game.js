const { wrapCommand } = require('../utils/commandWrapper')
const {
  createEndGameLogComponents
} = require('../utils/gameLogEndResult')
const {
  postGrimRevealBoard,
  rollbackUnpostedReveal
} = require('../systems/discord/interactions/storytellerDashboard/revealBoardPosting')
const {
  trackRevealBoardMessage
} = require('../systems/discord/interactions/storytellerDashboard/endRevealOpen')

module.exports = {
  name: 'end-game',
  description: 'End the active game.',
  options: [],
  data: {
    name: 'end-game',
    description: 'End the active game.',
    options: []
  },
  storytellerChannelOnly: true,

  execute: wrapCommand(async (interaction, ctx) => {
    const { gameLifecycle } = ctx
    const result = await gameLifecycle.openEndReveal(
      interaction.guild.id,
      interaction.member
    )

    if (!result.ok) return result

    if (!result.ended) {
      const posted = await postGrimRevealBoard({
        cleanupExisting: !result.revealAlreadyOpen,
        existingMessageRef: result.reveal,
        failureMessage: 'The end-game reveal was prepared, but I could not post the public Grimoire reveal board.',
        failureSuggestion: 'Check my post-game channel permissions, then run `/end-game` again.',
        gameManager: ctx.gameManager,
        interaction,
        labels: {},
        revealId: result.reveal.id,
        serverConfig: ctx.serverConfig,
        view: result.view
      })

      if (!posted.ok) {
        if (!result.revealAlreadyOpen) {
          await rollbackUnpostedReveal(gameLifecycle, interaction, result.reveal.id)
        }
        return posted
      }

      trackRevealBoardMessage(result.reveal, posted.message, gameLifecycle)
      return {
        ok: true,
        title: result.revealAlreadyOpen ? 'Reveal board reopened' : 'Reveal board posted',
        message: result.revealAlreadyOpen
          ? 'Continue revealing hidden roles in the post-game channel.'
          : 'Reveal at least one role in the post-game channel, then choose the winning team.'
      }
    }

    const logComponents = await createEndGameLogComponents({
      client: interaction.client,
      deletePendingGameSummary: ctx.deletePendingGameSummary,
      guildId: interaction.guild.id,
      result,
      serverConfigs: ctx.serverConfigs
    })

    return {
      ...result,
      postGameComponents: logComponents,
      postGameMessage: logComponents.length
        ? 'The game has ended. Save or discard this game history here.'
        : null,
      publicMessage: `The game has ended.\nWinner: ${result.winner}\nReason: ${result.reason}`
    }
  }, { ephemeral: false })
}
