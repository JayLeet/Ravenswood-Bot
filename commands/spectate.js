const { wrapCommand } = require('../utils/commandWrapper')

module.exports = {
  name: 'spectate',
  description: 'Join the active game as a spectator.',
  options: [],
  data: {
    name: 'spectate',
    description: 'Join the active game as a spectator.',
    options: []
  },

  execute: wrapCommand(async (interaction, { gameLifecycle }) => {
    const result = await gameLifecycle.spectate(
      interaction.guild.id,
      interaction.member
    )

    if (!result.ok) return result

    return {
      ok: true,
      message: 'You are now spectating',
      spectatorMessage: `<@${interaction.member.id}> is now spectating.`,
      view: result.view
    }
  })
}
