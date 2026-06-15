const {
  isStaleMessageError
} = require('../../../utils/discord/messageActions')
const {
  runRecoverableDiscordAction
} = require('../../../utils/discord/recoverableAction')

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
  clearTrackedPanelMessage,
  fetchTrackedPanelMessage,
  pruneMessageSignatures
}
