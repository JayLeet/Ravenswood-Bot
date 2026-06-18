const { wrapCommand } = require('../utils/commandWrapper')

module.exports = {
  name: 'become-storyteller',
  description: 'Become the Storyteller for the active game.',
  options: [],
  data: {
    name: 'become-storyteller',
    description: 'Become the Storyteller for the active game.',
    options: []
  },

  execute: wrapCommand(async (interaction, { gameLifecycle }) => {
    const result = await gameLifecycle.becomeStoryteller(
      interaction.guild.id,
      interaction.member
    )

    if (!result.ok) return result

    return {
      ok: true,
      message: `<@${interaction.member.id}> is now the new Storyteller.`,
      publicMessage: `<@${interaction.member.id}> is now the new Storyteller.`,
      view: result.view
    }
  }, {
    ephemeral: (interaction, ctx) =>
      interaction.channelId === ctx.serverConfig?.gameChannelId
  })
}
