const { cleanupSetupChannels } = require('../../../../utils/channelCleanup')
const {
  editDashboardLifecycleFailure,
  editDashboardSuccess,
  sendDashboardFeedback
} = require('../feedback')

function createDashboardLifecycleResultHandler({
  clearStorytellerDashboardState,
  dashboardState,
  postOrUpdateStorytellerDashboard,
  services = {}
}) {
  return async function handleDashboardLifecycleResult(interaction, context, result, successMessage, liveMessage = null) {
    if (!result.ok) return editDashboardLifecycleFailure(interaction, result)

    if (result.ended) {
      await sendDashboardFeedback(
        interaction,
        'Game ended',
        `Winner: ${result.winner}\nReason: ${result.reason}`,
        0xf1c40f
      )

      if (result.cleanupSetupChannels) {
        await cleanupSetupChannels(interaction.client, context.serverConfig)
      }

      await sendGamePanelNotices(services, interaction, context.serverConfig, {
        liveMessage: liveMessage || result.publicMessage,
        publicEmbeds: result.publicEmbeds,
        spectatorMessage: result.spectatorMessage
      })

      clearStorytellerDashboardState(interaction.guild.id)
      return
    }

    await postOrUpdateStorytellerDashboard(
      interaction.client,
      interaction.guild.id,
      dashboardState.getSelectedPlayer(interaction.guild.id, interaction.member.id)
    )

    if (liveMessage || result.publicEmbeds?.length) {
      await sendGamePanelNotices(services, interaction, context.serverConfig, {
        liveMessage,
        publicEmbeds: result.publicEmbeds
      })
    }

    return editDashboardSuccess(interaction, successMessage || 'Done.')
  }
}

async function sendGamePanelNotices(services, interaction, serverConfig, result) {
  if (typeof services?.sendGamePanelNotices !== 'function') return null
  return services.sendGamePanelNotices(interaction, serverConfig, result)
}

module.exports = {
  createDashboardLifecycleResultHandler,
  sendGamePanelNotices
}
