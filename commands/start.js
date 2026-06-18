const { wrapCommand } = require('../utils/commandWrapper')

module.exports = {
  name: 'start',
  description: 'Start the active game.',
  options: [],
  data: {
    name: 'start',
    description: 'Start the active game.',
    options: []
  },
  storytellerChannelOnly: true,

  execute: wrapCommand(async (interaction, { gameLifecycle }) => {
    const result = await gameLifecycle.startGame(
      interaction.guild.id,
      interaction.member
    )

    if (!result.ok) return result

    return {
      ok: true,
      message: `Game started successfully. Current phase: ${result.view.phaseLabel}.`,
      publicMessage: `The game has started. Current phase: ${result.view.phaseLabel}.`,
      view: result.view
    }
  }, { ephemeral: false })
}
