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
    const liveNotice = normalizeLiveNotice(liveMessage)

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
        liveMessage: liveNotice.message || result.publicMessage,
        publicComponents: liveNotice.components,
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

    if (liveNotice.message || liveNotice.components?.length || result.publicEmbeds?.length) {
      await sendGamePanelNotices(services, interaction, context.serverConfig, {
        liveMessage: liveNotice.message,
        publicComponents: liveNotice.components,
        publicEmbeds: result.publicEmbeds
      })
    }

    return editDashboardSuccess(interaction, successMessage || 'Done.')
  }
}

function normalizeLiveNotice(liveNotice) {
  if (!liveNotice || typeof liveNotice === 'string') {
    return { components: null, message: liveNotice || null }
  }
  return {
    components: liveNotice.components?.length ? liveNotice.components : null,
    message: liveNotice.message || null
  }
}

async function sendGamePanelNotices(services, interaction, serverConfig, result) {
  if (typeof services?.sendGamePanelNotices !== 'function') return null
  return services.sendGamePanelNotices(interaction, serverConfig, result)
}

module.exports = {
  createDashboardLifecycleResultHandler,
  normalizeLiveNotice,
  sendGamePanelNotices
}
