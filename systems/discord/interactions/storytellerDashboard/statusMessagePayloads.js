const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js')
const {
  STORYTELLER_DASHBOARD_ACTIONS
} = require('../../embeds')
const {
  DASHBOARD_SUCCESS_TITLE
} = require('../feedback')

const DASHBOARD_FEEDBACK_TITLES = new Set([
  'Action delayed',
  DASHBOARD_SUCCESS_TITLE,
  'Action failed',
  'Action finished',
  'Action needs attention',
  'Action still running',
  'Loading...',
  // Keep legacy dashboard feedback recognizable so old status messages clean up safely.
  'Done'
])

function createPayloadFromMessage(message) {
  return {
    embeds: serializeMessageItems(message.embeds),
    components: serializeMessageItems(message.components)
  }
}

function serializeMessageItems(items = []) {
  return items.map(item => typeof item?.toJSON === 'function' ? item.toJSON() : item)
}

function hasPayloadContent(payload) {
  return (payload.embeds || []).length > 0 || (payload.components || []).length > 0
}

function shouldClearNightOrderGuidance(payload) {
  const embeds = payload?.embeds || []
  if (!embeds.length) return false
  return !embeds.every(isDashboardFeedbackEmbed)
}

function isDashboardFeedbackEmbed(embed) {
  const title = embed?.data?.title || embed?.title
  return DASHBOARD_FEEDBACK_TITLES.has(title)
}

function isTemporaryDashboardFeedback(payload) {
  const embeds = payload?.embeds || []
  return embeds.length > 0 && embeds.every(isDashboardFeedbackEmbed)
}

function prunePayloadMemory(serverConfigs, state) {
  const activeIds = getActiveStatusMessageIds(serverConfigs)
  let removed = 0
  for (const messageId of state.payloadsByMessageId.keys()) {
    if (activeIds.has(messageId)) continue
    state.payloadsByMessageId.delete(messageId)
    state.payloadSignatures.delete(messageId)
    removed += 1
  }
  for (const messageId of state.payloadSignatures.keys()) {
    if (activeIds.has(messageId)) continue
    state.payloadSignatures.delete(messageId)
    removed += 1
  }
  return removed
}

function getActiveStatusMessageIds(serverConfigs) {
  return new Set([...serverConfigs.values()]
    .map(config => config?.storytellerDashboardStatusMessageId)
    .filter(Boolean))
}

function createGotItRow() {
  return new ActionRowBuilder().addComponents(new ButtonBuilder()
    .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.statusDismiss)
    .setLabel('Got it')
    .setStyle(ButtonStyle.Secondary))
}

module.exports = {
  createGotItRow,
  createPayloadFromMessage,
  getActiveStatusMessageIds,
  hasPayloadContent,
  isDashboardFeedbackEmbed,
  isTemporaryDashboardFeedback,
  prunePayloadMemory,
  shouldClearNightOrderGuidance
}
