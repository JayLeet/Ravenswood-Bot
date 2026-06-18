const { ApplicationCommandOptionType } = require('discord.js')
const { wrapCommand } = require('../utils/commandWrapper')
const {
  fetchGuildMemberWithRecoverableFallback
} = require('../utils/discord/recoverableFetch')
const {
  createGrimoireAccessGrantedMessage
} = require('../utils/grimoireAccess')
const {
  createBotLogger
} = require('../utils/logger')
const {
  getSelectedPendingRequest
} = require('../utils/pendingRequestSelection')

const PLAYER_OPTION_NAME = 'player'
const log = createBotLogger({ subsystem: 'ApproveCommand' })
const options = [
  {
    name: PLAYER_OPTION_NAME,
    description: 'The player with a pending request to approve.',
    type: ApplicationCommandOptionType.User,
    required: true
  }
]

module.exports = {
  name: 'approve',
  description: 'Approve a pending join or grimoire request.',
  options,
  data: {
    name: 'approve',
    description: 'Approve a pending join or grimoire request.',
    options
  },
  storytellerChannelOnly: true,

  execute: wrapCommand(async (interaction, { gameLifecycle }) => {
    const selected = getSelectedPendingRequest(interaction, gameLifecycle, PLAYER_OPTION_NAME)
    if (!selected.ok) return selected

    const requestedMember = await fetchGuildMemberWithRecoverableFallback({
      action: 'fetch-approval-request-member',
      context: {
        requestId: selected.request.id
      },
      guild: interaction.guild,
      logger: log,
      userId: selected.user.id
    })

    if (!requestedMember) {
      return {
        ok: false,
        error: { message: 'Selected user is no longer in this server.' }
      }
    }

    const result = await gameLifecycle.approveRequest(
      interaction.guild.id,
      interaction.member,
      selected.request.id,
      requestedMember
    )

    if (!result.ok) return result

    return {
      ok: true,
      message: `Approved ${result.request.type} request for <@${result.request.userId}>.`,
      ...createApprovalNotice(result.request),
      view: result.view
    }
  })
}

function createApprovalNotice(request) {
  if (request.type === 'grimoire') return { spectatorMessage: createGrimoireAccessGrantedMessage(request.userId) }
  return { publicMessage: `<@${request.userId}> your join request was approved.` }
}
