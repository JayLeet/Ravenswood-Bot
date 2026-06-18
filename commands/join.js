const { wrapCommand } = require('../utils/commandWrapper')

module.exports = {
  name: 'join',
  description: 'Join the active game as a player.',
  options: [],
  data: {
    name: 'join',
    description: 'Join the active game as a player.',
    options: []
  },

  execute: wrapCommand(async (interaction, { gameLifecycle }) => {
    const result = await gameLifecycle.join(
      interaction.guild.id,
      interaction.member
    )

    if (!result.ok) return result

    return {
      ok: true,
      message: result.message || 'You joined the game',
      publicMessage: result.publicMessage,
      view: result.view
    }
  })
}
