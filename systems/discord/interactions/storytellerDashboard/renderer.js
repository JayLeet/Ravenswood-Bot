const {
  createStorytellerDashboardPayload
} = require('../../embeds')
const {
  createMemberDisplayNameCache
} = require('../../../../utils/discord/memberDisplayNameCache')
const {
  runRecoverableDiscordAction
} = require('../../../../utils/discord/recoverableAction')
const {
  cleanupExtraDashboardEmbeds
} = require('./dashboardCleanup')
const {
  upsertDashboardMessage
} = require('./dashboardMessageRenderer')
const {
  syncNightOrderGuidanceMessage
} = require('./nightOrderGuidanceRenderer')
const {
  syncNominationDashboardMessage
} = require('./nominationDashboardRenderer')
const {
  createFakePlayerLabel,
  createFallbackPlayerLabel,
  isFakePlayer,
  pruneDashboardMessageSignatures
} = require('./rendererState')

const DEFAULT_DASHBOARD_RENDER_DEBOUNCE_MS = 300

function createStorytellerDashboardRenderer({
  serverConfigs,
  saveServerConfigs,
  gameLifecycle,
  isSetupComplete,
  dashboardState,
  moveStatusMessageToBottom = null,
  debounceMs = DEFAULT_DASHBOARD_RENDER_DEBOUNCE_MS
}) {
  const messageSignatures = new Map()
  const pendingRenders = new Map()
  const memberDisplayNames = createMemberDisplayNameCache({
    subsystem: 'StorytellerDashboardRenderer'
  })

  function postOrUpdate(discordClient, guildId, selectedPlayerId = null) {
    const key = String(guildId || '')
    const existing = pendingRenders.get(key)

    if (existing) {
      existing.discordClient = discordClient || existing.discordClient
      if (selectedPlayerId) existing.selectedPlayerId = selectedPlayerId
      return existing.promise
    }

    const pending = {
      discordClient,
      selectedPlayerId,
      promise: null,
      resolve: null,
      reject: null,
      timer: null
    }

    pending.promise = new Promise((resolve, reject) => {
      pending.resolve = resolve
      pending.reject = reject
      pending.timer = setTimeout(() => {
        pendingRenders.delete(key)
        postOrUpdateNow(pending.discordClient, guildId, pending.selectedPlayerId)
          .then(resolve)
          .catch(reject)
      }, debounceMs)
    })

    pendingRenders.set(key, pending)
    return pending.promise
  }

  function clear(guildId) {
    const key = String(guildId || '')
    const pending = pendingRenders.get(key)
    memberDisplayNames.clearGuild(guildId)
    if (!pending) return

    clearTimeout(pending.timer)
    pendingRenders.delete(key)
    pending.resolve(null)
  }

  async function postOrUpdateNow(discordClient, guildId, selectedPlayerId = null) {
    const serverConfig = serverConfigs.get(guildId)
    if (!isSetupComplete(serverConfig)) return null

    const view = gameLifecycle.getGameView(guildId)
    if (!view) return null

    const channel = await recover(
      'fetch-storyteller-dashboard-channel',
      () => discordClient.channels.fetch(serverConfig.storytellerChannelId),
      { channelId: serverConfig.storytellerChannelId, guildId }
    )

    if (!channel?.isTextBased()) return null

    const activeSelection =
      selectedPlayerId ||
      dashboardState.getSelectedPlayer(guildId, view.storytellerId)
    const playerLabels = await getPlayerLabels(discordClient, guildId, view)
    const payload = createStorytellerDashboardPayload(view, {
      selectedPlayerId: activeSelection,
      playerLabels
    })

    const message = await upsertDashboardMessage({
      channel,
      guildId,
      messageSignatures,
      moveStatusMessageToBottom,
      payload,
      saveServerConfigs,
      serverConfig,
      serverConfigs
    })
    await syncNightOrderGuidanceMessage({
      channel,
      guildId,
      messageSignatures,
      moveStatusMessageToBottom,
      playerLabels,
      saveServerConfigs,
      serverConfig,
      serverConfigs,
      view
    })
    await syncNominationDashboardMessage({
      channel,
      guildId,
      messageSignatures,
      moveStatusMessageToBottom,
      saveServerConfigs,
      serverConfig,
      serverConfigs,
      view
    })
    await cleanupExtraDashboardEmbeds(channel, serverConfig, message?.id, { guildId, saveServerConfigs, serverConfigs })
    return message
  }

  async function getPlayerLabels(discordClient, guildId, view) {
    const guild = discordClient.guilds.cache.get(guildId) ||
      await recover(
        'fetch-storyteller-dashboard-guild',
        () => discordClient.guilds.fetch(guildId),
        { guildId }
      )

    const labels = {}

    for (const userId of view.users.players || []) {
      if (view.users.displayNames?.[userId]) {
        labels[userId] = view.users.displayNames[userId]
        continue
      }

      if (isFakePlayer(view, userId) || !guild) {
        labels[userId] = createFakePlayerLabel(userId)
        continue
      }

      labels[userId] = await memberDisplayNames.getDisplayName(guild, userId, createFallbackPlayerLabel(userId))
    }

    return labels
  }

  return {
    clear,
    getRuntimeState: () => ({
      memberDisplayNameCache: memberDisplayNames.size(),
      messageSignatures: messageSignatures.size,
      pendingDisplayNameFetches: memberDisplayNames.pendingSize?.() || 0,
      pendingRenders: pendingRenders.size
    }),
    getPlayerLabels,
    postOrUpdate,
    memberDisplayNameCacheSize: memberDisplayNames.size,
    pruneMemberDisplayNameCache: memberDisplayNames.prune,
    pruneMessageSignatures: () => pruneDashboardMessageSignatures(messageSignatures, serverConfigs)
  }
}

function recover(action, fn, context = {}) {
  return runRecoverableDiscordAction(action, fn, {
    context,
    subsystem: 'StorytellerDashboardRenderer'
  })
}

module.exports = {
  DEFAULT_DASHBOARD_RENDER_DEBOUNCE_MS,
  createFakePlayerLabel,
  createStorytellerDashboardRenderer,
  isFakePlayer
}
