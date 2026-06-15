const {
  isStaleMessageError
} = require('../../../utils/discord/messageActions')
const {
  isUnknownChannelError
} = require('../../../utils/discord/interactionErrors')
const {
  runRecoverableDiscordAction
} = require('../../../utils/discord/recoverableAction')

async function fetchConfiguredPanelChannel({
  action,
  channelId,
  client,
  configKeys = [],
  context = {},
  guildId,
  saveServerConfigs,
  serverConfig,
  serverConfigs,
  subsystem
}) {
  if (!channelId) return { channel: null, stale: false, unavailable: false }

  try {
    const channel = await client.channels.fetch(channelId)
    return {
      channel: channel?.isTextBased?.() ? channel : null,
      stale: false,
      unavailable: false
    }
  } catch (err) {
    if (isUnknownChannelError(err)) {
      clearTrackedPanelConfig({
        configKeys,
        guildId,
        saveServerConfigs,
        serverConfig,
        serverConfigs
      })
      return { channel: null, stale: true, unavailable: false }
    }

    await runRecoverableDiscordAction(action, () => {
      throw err
    }, {
      context: {
        ...context,
        channelId
      },
      subsystem
    })
    return { channel: null, stale: false, unavailable: true }
  }
}

async function fetchTrackedPanelMessage({
  action,
  channel,
  context = {},
  messageId,
  subsystem
}) {
  if (!messageId) return { message: null, stale: false, unavailable: false }
  if (!channel?.messages?.fetch) {
    await runRecoverableDiscordAction(`${action}-unavailable`, () => {
      throw new Error('Channel message API unavailable')
    }, {
      context: {
        ...context,
        channelId: channel?.id,
        messageId
      },
      subsystem
    })
    return { message: null, stale: false, unavailable: true }
  }

  try {
    const message = await channel.messages.fetch(messageId)
    return { message, stale: false, unavailable: false }
  } catch (err) {
    if (isStaleMessageError(err)) return { message: null, stale: true, unavailable: false }

    await runRecoverableDiscordAction(action, () => {
      throw err
    }, {
      context: {
        ...context,
        channelId: channel.id,
        messageId
      },
      subsystem
    })
    return { message: null, stale: false, unavailable: true }
  }
}

function clearTrackedPanelMessage({
  configKey,
  guildId,
  saveServerConfigs,
  serverConfig,
  serverConfigs
}) {
  if (!serverConfig?.[configKey]) return false
  delete serverConfig[configKey]
  serverConfigs.set(guildId, serverConfig)
  saveServerConfigs(serverConfigs)
  return true
}

function clearTrackedPanelConfig({
  configKeys = [],
  guildId,
  saveServerConfigs,
  serverConfig,
  serverConfigs
}) {
  let changed = false
  for (const key of configKeys) {
    if (!serverConfig?.[key]) continue
    delete serverConfig[key]
    changed = true
  }
  if (!changed) return false
  serverConfigs.set(guildId, serverConfig)
  saveServerConfigs(serverConfigs)
  return true
}

function pruneMessageSignatures(messageSignatures, serverConfigs, configKey) {
  const activeMessageIds = new Set([...serverConfigs.values()]
    .map(config => config?.[configKey])
    .filter(Boolean))
  let removed = 0

  for (const messageId of messageSignatures.keys()) {
    if (activeMessageIds.has(messageId)) continue
    messageSignatures.delete(messageId)
    removed += 1
  }

  return removed
}

module.exports = {
  clearTrackedPanelConfig,
  clearTrackedPanelMessage,
  fetchConfiguredPanelChannel,
  fetchTrackedPanelMessage,
  pruneMessageSignatures
}
