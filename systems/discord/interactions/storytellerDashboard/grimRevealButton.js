const {
  createGrimRevealPayload,
  parseGrimRevealCustomId
} = require('../../embeds')
const {
  acknowledgeInteraction,
  editDashboardFailure
} = require('../feedback')
const {
  cleanupSetupChannels
} = require('../../../../utils/channelCleanup')
const {
  queuedMessageEdit
} = require('../../../../utils/discord/messageActions')
const {
  createBotLogger
} = require('../../../../utils/logger')

const log = createBotLogger({ subsystem: 'GrimRevealButton' })

function createGrimRevealButtonHandler({
  gameLifecycle,
  getDashboardPlayerLabels
}) {
  return async function handleGrimRevealButton(interaction, context) {
    const reveal = parseGrimRevealCustomId(interaction.customId)
    if (!reveal) return null

    const result = await gameLifecycle.revealGrimPlayer(
      interaction.guild.id,
      interaction.member,
      reveal.playerId,
      reveal.revealId
    )

    if (!result.ok) return editDashboardFailure(interaction, result)
    await acknowledgeInteraction(interaction)

    const labels = await getDashboardPlayerLabels(interaction.client, interaction.guild.id, result.view)
    await queuedMessageEdit(interaction.message, createGrimRevealPayload(result.view, reveal.revealId, labels))
      .catch(err => {
        log.recoverable('update-grim-reveal-board', err, {
          guildId: interaction.guild?.id,
          messageId: interaction.message?.id,
          playerId: reveal.playerId,
          revealId: reveal.revealId
        })
      })

    if (result.cleanupSetupChannels) await cleanupSetupChannels(interaction.client, context.serverConfig)

    return true
  }
}

module.exports = {
  createGrimRevealButtonHandler
}
