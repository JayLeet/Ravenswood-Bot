const {
  editDashboardSuccess
} = require('../feedback')
const {
  createBotLogger
} = require('../../../../utils/logger')

const log = createBotLogger({ subsystem: 'StorytellerDashboardRefresh' })

async function handleRefresh(interaction, context, deps) {
  const {
    dashboardState,
    postOrUpdateStorytellerDashboard,
    services
  } = deps

  const recovered = await services?.recoverGameSession?.(interaction.client, interaction.guild.id)
    .catch(err => {
      log.recoverable('recover-game-session-from-refresh', err, {
        guildId: interaction.guild.id,
        userId: interaction.member?.id
      })
      return null
    })

  await postOrUpdateStorytellerDashboard(
    interaction.client,
    interaction.guild.id,
    dashboardState.getSelectedPlayer(interaction.guild.id, interaction.member.id)
  )

  return editDashboardSuccess(interaction, formatRefreshMessage(recovered, context))
}

function formatRefreshMessage(recovered, context = {}) {
  if (!recovered) return 'Dashboard refreshed.'

  const parts = [
    'Game state refreshed.',
    `Panels: ${countRecoveredPanels(recovered)}`,
    `Night prompts: ${recovered.nightPrompts || 0}`,
    `Voice channels: ${recovered.voiceChannels || 0}`
  ]
  if (recovered.voteCountsResumed) parts.push(`Vote counts resumed: ${recovered.voteCountsResumed}`)

  if (context.view?.phase) parts.push(`Phase: ${context.view.phase}`)
  return parts.join('\n')
}

function countRecoveredPanels(recovered) {
  return Number(recovered.storytellerDashboard || recovered.storytellerDashboards || 0) +
    Number(recovered.gamePanel || recovered.gamePanels || 0) +
    Number(recovered.playerGrimoirePanel || recovered.playerGrimoirePanels || 0) +
    Number(recovered.votingPanels || 0)
}

module.exports = {
  countRecoveredPanels,
  formatRefreshMessage,
  handleRefresh
}
