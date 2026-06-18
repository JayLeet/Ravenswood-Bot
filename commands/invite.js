const {
  ApplicationCommandOptionType
} = require('discord.js')
const {
  wrapCommand
} = require('../utils/commandWrapper')
const {
  getRoomOwnerForInteraction,
  respondPrivateVoiceAutocomplete,
  sendPrivateVoiceRequest
} = require('../systems/discord/interactions/privateVoiceRequestActions')

const options = [
  {
    name: 'player',
    description: 'Current player to invite into this private voice room.',
    type: ApplicationCommandOptionType.String,
    required: true,
    autocomplete: true
  }
]

module.exports = {
  name: 'invite',
  description: 'Invite another player into your current private voice room.',
  options,
  data: {
    name: 'invite',
    description: 'Invite another player into your current private voice room.',
    options
  },

  execute: wrapCommand(async (interaction, { gameLifecycle }) => {
    const game = gameLifecycle.get(interaction.guild.id)
    const roomOwnerId = getRoomOwnerForInteraction(game, interaction)
    if (!roomOwnerId) {
      return gameLifecycle.createError(
        gameLifecycle.errorTypes.INVALID_STATE,
        'Use this command inside a private voice room.'
      )
    }

    return sendPrivateVoiceRequest({
      interaction,
      gameLifecycle,
      targetId: interaction.options.getString('player', true),
      roomOwnerId
    })
  }),

  async autocomplete(interaction, { gameLifecycle }) {
    const game = gameLifecycle.get(interaction.guild.id)
    return respondPrivateVoiceAutocomplete(interaction, gameLifecycle, {
      roomOwnerId: getRoomOwnerForInteraction(game, interaction)
    })
  }
}
