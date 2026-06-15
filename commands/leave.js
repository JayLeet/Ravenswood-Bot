const { wrapCommand } = require('../systems/discord/interactions/commandWrapper')

module.exports = {
  name: 'leave',
  description: 'Leave the active game.',
  options: [],
  data: {
    name: 'leave',
    description: 'Leave the active game.',
    options: []
  },

  execute: wrapCommand(async (interaction, { gameLifecycle }) => {
    const result = await gameLifecycle.leave(
      interaction.guild.id,
      interaction.member
    )

    return result
  })
}
