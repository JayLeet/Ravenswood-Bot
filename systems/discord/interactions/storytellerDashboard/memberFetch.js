const {
  fetchGuildMemberWithRecoverableFallback
} = require('../../../../utils/discord/recoverableFetch')
const {
  createBotLogger
} = require('../../../../utils/logger')

const log = createBotLogger({ subsystem: 'StorytellerDashboardMemberFetch' })

function fetchDashboardMember(interaction, userId, action, fallback = null) {
  return fetchGuildMemberWithRecoverableFallback({
    action,
    context: {
      userId
    },
    guild: interaction.guild,
    logger: log,
    userId
  }).then(member => member || fallback)
}

module.exports = {
  fetchDashboardMember
}
