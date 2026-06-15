const {
  parseNominationRequestInteraction
} = require('../../../utils/nominationRequests')
const {
  replyPrivateSystem,
  updateInteraction
} = require('./feedback')
const {
  createBotLogger
} = require('../../../utils/logger')

const log = createBotLogger({ subsystem: 'NominationRequests' })

function createNominationRequestInteractionSystem({
  gameLifecycle,
  postOrUpdateStorytellerDashboard
}) {
  async function handleNominationRequestInteraction(interaction) {
    const parsed = parseNominationRequestInteraction(interaction.customId)
    if (!parsed || parsed.action !== 'rescind') return null

    const result = gameLifecycle.rescindNominationRequest(
      interaction.guild.id,
      interaction.member,
      parsed.requestId
    )

    if (!result.ok) {
      return replyPrivateSystem(
        interaction,
        'Action failed',
        result.error?.message || 'Could not rescind that nomination request.'
      )
    }

    await updateInteraction(interaction, {
      content: 'Your request has been rescinded.',
      embeds: [],
      components: []
    }).catch(err => {
      log.recoverable('update-rescinded-nomination-request', err, {
        guildId: interaction.guild?.id,
        messageId: interaction.message?.id,
        requestId: parsed.requestId,
        userId: interaction.user?.id
      })
      return null
    })

    await postOrUpdateStorytellerDashboard(interaction.client, interaction.guild.id).catch(err => {
      log.recoverable('refresh-dashboard-after-nomination-rescind', err, {
        guildId: interaction.guild.id,
        requestId: parsed.requestId,
        userId: interaction.user?.id
      })
      return null
    })
    return true
  }

  return {
    handleNominationRequestInteraction
  }
}

module.exports = {
  createNominationRequestInteractionSystem
}
