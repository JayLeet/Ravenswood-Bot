const {
  fetchTrackedPanelMessage
} = require('../panelMessageRefs')
const {
  runRecoverableDiscordAction
} = require('../../../../utils/discord/recoverableAction')

async function fetchStatusMessage(channel, messageId) {
  return (await fetchStatusMessageState(channel, messageId))?.message || null
}

function fetchStatusMessageState(channel, messageId, context = {}) {
  if (!messageId) return { message: null, stale: false, unavailable: false }
  return fetchTrackedPanelMessage({
    action: 'fetch-dashboard-status-message',
    channel,
    context,
    messageId,
    subsystem: context.subsystem || 'StorytellerDashboardStatus'
  })
}

function logStatusDeleteFailure(action, err, context = {}) {
  const { subsystem = 'StorytellerDashboardStatus', ...rest } = context
  return runRecoverableDiscordAction(action, () => {
    throw err
  }, {
    context: rest,
    subsystem
  })
}

module.exports = {
  fetchStatusMessage,
  fetchStatusMessageState,
  logStatusDeleteFailure
}
