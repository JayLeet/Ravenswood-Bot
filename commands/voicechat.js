const {
  ApplicationCommandOptionType
} = require('discord.js')
const {
  wrapCommand
} = require('../systems/discord/interactions/commandWrapper')
const {
  respondPrivateVoiceAutocomplete,
  sendPrivateVoiceRequest
} = require('../systems/discord/interactions/privateVoiceRequestActions')

const options = [
  {
    name: 'player',
    description: 'Current player to request a private voice chat with.',
    type: ApplicationCommandOptionType.String,
    required: true,
    autocomplete: true
  }
]

module.exports = {
  name: 'voicechat',
  description: 'Request a private day voice chat with another player.',
  options,
  data: {
    name: 'voicechat',
    description: 'Request a private day voice chat with another player.',
    options
  },

  execute: wrapCommand(async (interaction, { gameLifecycle }) => {
    return sendPrivateVoiceRequest({
      interaction,
      gameLifecycle,
      targetId: interaction.options.getString('player', true)
    })
  }),

  async autocomplete(interaction, { gameLifecycle }) {
    return respondPrivateVoiceAutocomplete(interaction, gameLifecycle)
  }
}
