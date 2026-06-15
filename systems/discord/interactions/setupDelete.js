const {
  executeSetupDelete,
  isSetupDeleteInteraction
} = require('../../../utils/setupDelete')
const {
  createSystemEmbed,
  deferPrivateReply,
  editInteractionReply
} = require('./feedback')

function createSetupDeleteInteractionSystem({ gameLifecycle, saveServerConfigs, serverConfigs }) {
  async function handleSetupDeleteInteraction(interaction) {
    if (!isSetupDeleteInteraction(interaction.customId)) return null

    await deferPrivateReply(interaction)
    const result = await executeSetupDelete(interaction, {
      gameLifecycle,
      saveServerConfigs,
      serverConfigs
    })

    if (!result.ok) {
      return editInteractionReply(interaction, {
        embeds: [createSystemEmbed('Setup delete failed', result.error?.message || 'Unknown error')]
      })
    }

    return editInteractionReply(interaction, {
      embeds: result.embeds,
      components: []
    })
  }

  return { handleSetupDeleteInteraction }
}

module.exports = {
  createSetupDeleteInteractionSystem,
  isSetupDeleteInteraction
}
