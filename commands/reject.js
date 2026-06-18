const { ApplicationCommandOptionType } = require('discord.js')
const { wrapCommand } = require('../utils/commandWrapper')
const {
  getSelectedPendingRequest
} = require('../utils/pendingRequestSelection')

const PLAYER_OPTION_NAME = 'player'
const options = [
  {
    name: PLAYER_OPTION_NAME,
    description: 'The player with a pending request to reject.',
    type: ApplicationCommandOptionType.User,
    required: true
  }
]

module.exports = {
  name: 'reject',
  description: 'Reject a pending join or grimoire request.',
  options,
  data: {
    name: 'reject',
    description: 'Reject a pending join or grimoire request.',
    options
  },
  storytellerChannelOnly: true,

  execute: wrapCommand(async (interaction, { gameLifecycle }) => {
    const selected = getSelectedPendingRequest(interaction, gameLifecycle, PLAYER_OPTION_NAME)
    if (!selected.ok) return selected

    const result = await gameLifecycle.rejectRequest(
      interaction.guild.id,
      interaction.member,
      selected.request.id
    )

    if (!result.ok) return result

    const notice = createNotice(result.request)

    return {
      ok: true,
      message: `Rejected ${result.request.type} request for <@${result.request.userId}>.`,
      publicMessage: notice.publicMessage,
      spectatorMessage: notice.spectatorMessage
    }
  })
}

function createNotice(request) {
  const message = `<@${request.userId}> your ${request.type} request was not approved.`

  if (request.type === 'join') return { publicMessage: message }
  return { spectatorMessage: message }
}
