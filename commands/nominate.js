const { ApplicationCommandOptionType } = require('discord.js')
const { wrapCommand } = require('../utils/commandWrapper')
const {
  createRescindNominationRequestRow
} = require('../utils/nominationRequests')

module.exports = {
  name: 'nominate',
  description: 'Nominate a player during the day.',
  options: [
    {
      name: 'player',
      description: 'The player you are nominating.',
      type: ApplicationCommandOptionType.User,
      required: true
    }
  ],
  data: {
    name: 'nominate',
    description: 'Nominate a player during the day.',
    options: [
      {
        name: 'player',
        description: 'The player you are nominating.',
        type: ApplicationCommandOptionType.User,
        required: true
      }
    ]
  },

  execute: wrapCommand(async (interaction, { gameLifecycle }) => {
    const nominee = interaction.options.getUser('player', true)
    const result = await gameLifecycle.createNominationRequest(
      interaction.guild.id,
      interaction.member,
      nominee.id
    )

    if (!result.ok) return result

    return {
      ok: true,
      message:
        `Your nomination of <@${nominee.id}> is queued for Storyteller approval. ` +
        `Queue position: ${result.queuePosition}.\n\n` +
        'Use the button below if you want to rescind this nomination before it is approved.',
      components: [createRescindNominationRequestRow(result.request.id)],
      publicMessage: null,
      request: result.request
    }
  })
}