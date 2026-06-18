const { wrapCommand } = require('../utils/commandWrapper')

module.exports = {
  name: 'resume',
  description: 'Resume a paused game.',
  options: [],
  data: {
    name: 'resume',
    description: 'Resume a paused game.',
    options: []
  },
  storytellerChannelOnly: true,

  execute: wrapCommand(async (interaction, { gameLifecycle }) => {
    const result = await gameLifecycle.session.resumeGame(
      gameLifecycle,
      interaction.guild.id,
      interaction.member
    )

    if (!result.ok) return result

    return {
      ok: true,
      message: 'The paused game was resumed.',
      publicMessage: result.publicMessage,
      storytellerMessage: result.storytellerMessage,
      view: result.view
    }
  })
}
