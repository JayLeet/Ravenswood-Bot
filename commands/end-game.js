const { wrapCommand } = require('../systems/discord/interactions/commandWrapper')
const {
  createGameLogDecisionRows
} = require('../utils/gameLogDecisions')

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

  execute: wrapCommand(async (interaction, { gameLifecycle }) => {
    const result = await gameLifecycle.endGame(
      interaction.guild.id,
      interaction.member
    )

    if (!result.ok) return result

    return {
      ...result,
      publicComponents: createGameLogDecisionRows(result.pendingSummary?.id),
      publicMessage: `The game has ended.\nWinner: ${result.winner}\nReason: ${result.reason}`
    }
  }, { ephemeral: false })
}
