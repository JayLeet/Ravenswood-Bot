const {
  STORYTELLER_DASHBOARD_ACTIONS
} = require('../../embeds')
const {
  createBotLogger
} = require('../../../../utils/logger')

const log = createBotLogger({ subsystem: 'StorytellerDashboardControls' })

const LEGACY_BUTTON_ALIASES = Object.freeze({
  'botc:storyteller:randomize-roles': STORYTELLER_DASHBOARD_ACTIONS.randomRoles
})

function normalizeDashboardButtonCustomId(interaction) {
  const normalized = getLegacyDashboardButtonAlias(interaction.customId)
  if (!normalized) return false

  log.warn('legacy-dashboard-button-alias', 'Routing legacy dashboard button to current handler.', {
    ...createDashboardControlContext(interaction),
    normalizedCustomId: normalized
  })
  interaction.customId = normalized
  return true
}

function getLegacyDashboardButtonAlias(customId) {
  return LEGACY_BUTTON_ALIASES[String(customId || '')] || null
}

function createUnsupportedDashboardControlFailure(kind) {
  const label = kind === 'form' ? 'form' : kind === 'dropdown' ? 'dropdown' : 'button'
  return {
    title: 'Unknown control',
    message: `That Storyteller dashboard ${label} is old or no longer supported by this bot version.`,
    suggestion: 'Refresh the Storyteller dashboard or reopen the current dashboard menu.'
  }
}

function reportUnsupportedDashboardControl(interaction, kind) {
  log.warn(`unsupported-dashboard-${kind}`, getUnsupportedControlSummary(interaction.customId), createDashboardControlContext(interaction))
}

function isStorytellerRelatedControl(customId) {
  return String(customId || '').startsWith('botc:storyteller')
}

function createUnsupportedStorytellerControlMessage(kind) {
  const label = kind === 'button' ? 'button' : 'control'
  return {
    message: `That Storyteller ${label} is old, missing, or unsupported by this bot version.`,
    suggestion: 'Refresh the relevant Storyteller panel, then try the current control.'
  }
}

function reportUnsupportedStorytellerControl(interaction, kind) {
  log.warn(`unsupported-storyteller-${kind}`, getUnsupportedControlSummary(interaction.customId), createDashboardControlContext(interaction))
}

function getUnsupportedControlSummary(customId) {
  const value = String(customId || '')
  if (value === STORYTELLER_DASHBOARD_ACTIONS.advanceVoteCursor) return 'Legacy vote cursor control.'
  if (value.startsWith('botc:storyteller-grim:blank')) return 'Storyteller Grimoire spacer control.'
  if (value.startsWith('botc:storyteller:timer-control:')) return 'Storyteller timer control missed timer routing.'
  return 'Unsupported Storyteller control.'
}

function createDashboardControlContext(interaction) {
  return {
    channelId: interaction.channelId,
    customId: interaction.customId,
    guildId: interaction.guild?.id,
    messageId: interaction.message?.id,
    type: interaction.type,
    userId: interaction.user?.id || interaction.member?.id
  }
}

module.exports = {
  createUnsupportedDashboardControlFailure,
  createUnsupportedStorytellerControlMessage,
  getLegacyDashboardButtonAlias,
  isStorytellerRelatedControl,
  normalizeDashboardButtonCustomId,
  reportUnsupportedDashboardControl,
  reportUnsupportedStorytellerControl
}
