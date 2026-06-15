const {
  isStaleMessageError,
  queuedMessageDelete
} = require('../../../../utils/discord/messageActions')
const {
  isStorytellerDashboardAction
} = require('../../../../utils/storytellerDashboard/constants')
const {
  fetchWithRecoverableFallback
} = require('../../../../utils/discord/recoverableFetch')
const {
  createBotLogger
} = require('../../../../utils/logger')

const DASHBOARD_COMPANION_TITLES = Object.freeze({
  'Night Order Guidance': 'storytellerNightOrderGuidanceMessageId',
  'Nomination Dashboard': 'storytellerNominationDashboardMessageId'
})
const DASHBOARD_PANEL_TITLES = new Set([
  'Action failed',
  'Done',
  'Night Order Guidance',
  'Nomination Dashboard',
  'Storyteller Dashboard'
])
const log = createBotLogger({ subsystem: 'DashboardCleanup' })

async function cleanupExtraDashboardEmbeds(channel, serverConfig, dashboardMessageId, options = {}) {
  if (!channel?.messages?.fetch) return
  const logger = options.logger || log
  const messages = await fetchDashboardMessages(channel, logger, 'fetch-dashboard-cleanup-messages')
  if (!messages) return

  const botEmbeds = [...messages.values()]
    .filter(message => message.author?.bot)
    .filter(message => message.embeds?.length)
    .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
  const allowed = createAllowedIds(serverConfig, dashboardMessageId)
  const duplicateDashboardIds = findDuplicateDashboardPanelIds(botEmbeds, dashboardMessageId)
  const duplicateCompanionIds = findDuplicateCompanionPanelIds(botEmbeds, serverConfig)
  const oldCompanionIds = findOlderCompanionIds(botEmbeds, serverConfig, dashboardMessageId)
  const untrackedEmbedIds = findUntrackedDashboardEmbedIds(botEmbeds, allowed)

  if (
    !duplicateDashboardIds.size &&
    !duplicateCompanionIds.size &&
    !oldCompanionIds.size &&
    !untrackedEmbedIds.size &&
    botEmbeds.length <= 4
  ) return

  let changedConfig = false
  for (const message of botEmbeds) {
    if (duplicateDashboardIds.has(message.id)) {
      await deleteDashboardMessage(message, logger, 'delete-duplicate-dashboard-panel', 'Clean up duplicate Storyteller dashboard panel')
      continue
    }
    if (duplicateCompanionIds.has(message.id)) {
      const deleted = await deleteDashboardMessage(message, logger, 'delete-duplicate-dashboard-companion-panel', 'Clean up duplicate Storyteller dashboard companion panel')
      if (deleted) {
        clearTrackedCompanionId(serverConfig, message.id)
        changedConfig = true
      }
      continue
    }
    if (oldCompanionIds.has(message.id)) {
      const deleted = await deleteDashboardMessage(message, logger, 'delete-old-dashboard-companion-panel', 'Keep Storyteller dashboard first')
      if (deleted) {
        clearTrackedCompanionId(serverConfig, message.id)
        changedConfig = true
      }
      continue
    }
    if (allowed.has(message.id)) continue
    if (untrackedEmbedIds.has(message.id) || (botEmbeds.length > 4 && isDashboardManagedMessage(message))) {
      await deleteDashboardMessage(message, logger, 'delete-stale-dashboard-embed', 'Clean up stale Storyteller dashboard embed')
    }
  }

  if (changedConfig) saveConfig(options, serverConfig)
}

async function findReusableDashboardPanel(channel, title, excludedIds = [], logger = log) {
  if (!channel?.messages?.fetch) return null
  const messages = await fetchDashboardMessages(channel, logger, 'fetch-reusable-dashboard-panel-messages')
  if (!messages) return null

  const excluded = new Set(excludedIds.filter(Boolean))
  return [...messages.values()]
    .filter(message => message.author?.bot)
    .filter(message => !excluded.has(message.id))
    .filter(message => messageHasEmbedTitle(message, title))
    .sort((a, b) => (b.createdTimestamp || 0) - (a.createdTimestamp || 0))[0] ||
    null
}

async function fetchDashboardMessages(channel, logger, action) {
  return fetchWithRecoverableFallback({
    action,
    context: {
      channelId: channel?.id,
      guildId: channel?.guildId
    },
    fetch: () => channel.messages.fetch({ limit: 50 }),
    logger
  })
}

async function deleteDashboardMessage(message, logger, action, reason) {
  return queuedMessageDelete(message, reason).then(() => true).catch(err => {
    if (isStaleMessageError(err)) return true
    logger?.recoverable?.(action, err, {
      channelId: message?.channelId,
      guildId: message?.guildId,
      messageId: message?.id
    })
    return false
  })
}

function createAllowedIds(serverConfig, dashboardMessageId) {
  return new Set([
    dashboardMessageId,
    serverConfig.storytellerDashboardStatusMessageId,
    serverConfig.storytellerNightOrderGuidanceMessageId,
    serverConfig.storytellerNominationDashboardMessageId
  ].filter(Boolean))
}

function findUntrackedDashboardEmbedIds(messages, allowedIds) {
  return new Set(messages
    .filter(message => !allowedIds.has(message.id))
    .filter(isDashboardManagedMessage)
    .map(message => message.id))
}

function isDashboardManagedMessage(message) {
  return hasDashboardManagedTitle(message) || hasDashboardComponent(message)
}

function hasDashboardManagedTitle(message) {
  return (message.embeds || []).some(embed => DASHBOARD_PANEL_TITLES.has(getEmbedTitle(embed)))
}

function hasDashboardComponent(message) {
  return flattenComponents(message.components || [])
    .some(component => isStorytellerDashboardAction(component?.customId || component?.custom_id))
}

function flattenComponents(components = []) {
  return components.flatMap(component => {
    const data = typeof component?.toJSON === 'function' ? component.toJSON() : component
    const children = data?.components || component?.components || []
    return [data, ...flattenComponents(children)]
  })
}

function findDuplicateCompanionPanelIds(messages, serverConfig = {}) {
  const duplicateIds = new Set()

  for (const [title, configKey] of Object.entries(DASHBOARD_COMPANION_TITLES)) {
    const panels = messages.filter(message => messageHasEmbedTitle(message, title))
    if (panels.length <= 1) continue

    const trackedId = serverConfig?.[configKey]
    const keepId = trackedId && panels.some(message => message.id === trackedId)
      ? trackedId
      : panels[0].id

    for (const panel of panels) {
      if (panel.id !== keepId) duplicateIds.add(panel.id)
    }
  }

  return duplicateIds
}

function findOlderCompanionIds(messages, serverConfig, dashboardMessageId) {
  const dashboard = messages.find(message => message.id === dashboardMessageId)
  if (!dashboard) return new Set()
  const companionIds = new Set([
    serverConfig.storytellerDashboardStatusMessageId,
    serverConfig.storytellerNightOrderGuidanceMessageId,
    serverConfig.storytellerNominationDashboardMessageId
  ].filter(Boolean))
  return new Set(messages
    .filter(message => companionIds.has(message.id))
    .filter(message => message.createdTimestamp < dashboard.createdTimestamp)
    .map(message => message.id))
}

function clearTrackedCompanionId(serverConfig, messageId) {
  for (const key of [
    'storytellerDashboardStatusMessageId',
    'storytellerNightOrderGuidanceMessageId',
    'storytellerNominationDashboardMessageId'
  ]) {
    if (serverConfig[key] === messageId) delete serverConfig[key]
  }
}

function findDuplicateDashboardPanelIds(messages, dashboardMessageId) {
  const dashboardMessages = messages.filter(isStorytellerDashboardPanel)
  const keepId = dashboardMessageId || dashboardMessages[0]?.id || null
  return new Set(dashboardMessages
    .filter(message => message.id !== keepId)
    .map(message => message.id))
}

function isStorytellerDashboardPanel(message) {
  return messageHasEmbedTitle(message, 'Storyteller Dashboard')
}

function messageHasEmbedTitle(message, title) {
  return (message.embeds || []).some(embed => getEmbedTitle(embed) === title)
}

function getEmbedTitle(embed) {
  return embed?.title || embed?.data?.title || embed?.toJSON?.().title || null
}

function saveConfig({ guildId, saveServerConfigs, serverConfigs }, serverConfig) {
  if (!guildId || !serverConfigs || typeof saveServerConfigs !== 'function') return
  serverConfigs.set(guildId, serverConfig)
  saveServerConfigs(serverConfigs)
}

module.exports = {
  cleanupExtraDashboardEmbeds,
  deleteDashboardMessage,
  fetchDashboardMessages,
  findReusableDashboardPanel,
  findDuplicateCompanionPanelIds,
  findDuplicateDashboardPanelIds,
  findOlderCompanionIds,
  findUntrackedDashboardEmbedIds,
  hasDashboardComponent,
  isDashboardManagedMessage,
  isStorytellerDashboardPanel,
  messageHasEmbedTitle
}
