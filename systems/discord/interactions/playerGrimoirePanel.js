const {
  createPlayerGrimoirePanelPayload
} = require('../../../utils/playerGrimoirePanel')
const {
  createPayloadSignature
} = require('../../../utils/discord/payloadSignature')
const {
  queuedChannelSend,
  queuedMessageEdit
} = require('../../../utils/discord/messageActions')
const {
  runRecoverableDiscordAction
} = require('../../../utils/discord/recoverableAction')
const {
  clearTrackedPanelMessage,
  fetchTrackedPanelMessage,
  pruneMessageSignatures
} = require('./panelMessageRefs')

function createPlayerGrimoirePanelSystem({
  serverConfigs,
  saveServerConfigs,
  isSetupComplete
}) {
  const messageSignatures = new Map()
  const subsystem = 'PlayerGrimoirePanel'

  async function postOrUpdatePlayerGrimoirePanel(discordClient, guildId) {
    const serverConfig = serverConfigs.get(guildId)
    if (!isSetupComplete(serverConfig)) return null

    const channel = await fetchTextChannel(discordClient, serverConfig.playerGrimoireChannelId, {
      guildId,
      subsystem
    })

    if (!channel) return null

    const payload = createPlayerGrimoirePanelPayload()
    const signature = createPayloadSignature(payload)
    const fetched = await fetchTrackedPanelMessage({
      action: 'fetch-player-grimoire-panel',
      channel,
      context: { guildId },
      messageId: serverConfig.playerGrimoirePanelMessageId,
      subsystem
    })
    if (fetched.unavailable) return null
    let message = fetched.message
    if (fetched.stale) clearTrackedPanelMessage({
      configKey: 'playerGrimoirePanelMessageId',
      guildId,
      saveServerConfigs,
      serverConfig,
      serverConfigs
    })

    if (message) {
      if (messageSignatures.get(message.id) === signature) return message
      const updated = await recover('edit-player-grimoire-panel', () => queuedMessageEdit(message, payload), {
        channelId: channel.id,
        guildId,
        messageId: message.id,
        subsystem
      })
      if (updated) {
        messageSignatures.set(updated.id, signature)
        return updated
      }
    }

    message = await recover('send-player-grimoire-panel', () => queuedChannelSend(channel, payload), {
      channelId: channel.id,
      guildId,
      subsystem
    })
    if (!message) return null

    messageSignatures.set(message.id, signature)
    serverConfig.playerGrimoirePanelMessageId = message.id
    serverConfigs.set(guildId, serverConfig)
    saveServerConfigs(serverConfigs)
    return message
  }

  function getRuntimeState() {
    const removedMessageSignatures = pruneMessageSignatures(messageSignatures, serverConfigs, 'playerGrimoirePanelMessageId')
    return {
      messageSignatures: messageSignatures.size,
      removedMessageSignatures
    }
  }

  return {
    getRuntimeState,
    postOrUpdatePlayerGrimoirePanel
  }
}

async function fetchTextChannel(client, channelId, context = {}) {
  if (!channelId) return null
  const channel = await recover('fetch-player-grimoire-channel', () => client.channels.fetch(channelId), {
    ...context,
    channelId
  })
  return channel?.isTextBased?.() ? channel : null
}

function recover(action, fn, context = {}) {
  const { subsystem = 'PlayerGrimoirePanel', ...rest } = context
  return runRecoverableDiscordAction(action, fn, {
    context: rest,
    subsystem
  })
}

module.exports = {
  createPlayerGrimoirePanelSystem
}
