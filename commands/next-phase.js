const { wrapCommand } = require('../systems/discord/interactions/commandWrapper')
const {
  appendPrivateVoiceFeatureNotice
} = require('../utils/privateVoiceNotice')

module.exports = {
  name: 'next-phase',
  description: 'Advance the game to the next phase.',
  options: [],
  data: {
    name: 'next-phase',
    description: 'Advance the game to the next phase.',
    options: []
  },
  storytellerChannelOnly: true,

  execute: wrapCommand(async (interaction, { gameLifecycle }) => {
    const result = await gameLifecycle.advancePhase(
      interaction.guild.id,
      interaction.member
    )

    if (!result.ok) return result

    return {
      ok: true,
      message: `Advanced to ${result.phaseLabel}.`,
      publicMessage: appendPrivateVoiceFeatureNotice([
        result.publicMessage,
        `The game advanced to ${result.phaseLabel}.`
      ].filter(Boolean).join('\n'), result.phase)
    }
  }, { ephemeral: false })
}
