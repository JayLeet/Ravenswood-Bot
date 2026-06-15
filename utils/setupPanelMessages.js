const { createGamePanelPayload } = require('../systems/discord/embeds')
const {
  createPlayerGrimoirePanelPayload
} = require('./playerGrimoirePanel')
const {
  isStaleMessageError,
  queuedChannelSend,
  queuedMessageDelete
} = require('./discord/messageActions')
const {
  createBotLogger
} = require('./logger')

const log = createBotLogger({ subsystem: 'SetupPanelMessages' })

async function postSetupPanelMessages({ gameChannel, playerGrimoireChannel }) {
  const gamePanelMessage = await queuedChannelSend(gameChannel, createGamePanelPayload()).catch(err => {
    log.recoverable('send-setup-game-panel-message', err, createSetupPanelContext(gameChannel))
    return null
  })
  if (!gamePanelMessage) {
    return { ok: false, message: `I could not post the game panel in <#${gameChannel.id}>. Setup was not saved.` }
  }

  const playerGrimoirePanelMessage = await queuedChannelSend(playerGrimoireChannel, createPlayerGrimoirePanelPayload()).catch(err => {
    log.recoverable('send-setup-player-grimoire-panel-message', err, createSetupPanelContext(playerGrimoireChannel))
    return null
  })
  if (!playerGrimoirePanelMessage) {
    await queuedMessageDelete(gamePanelMessage).catch(err => {
      log.recoverable('cleanup-failed-setup-game-panel-message', err, createSetupPanelContext(gameChannel, gamePanelMessage))
    })
    return { ok: false, message: `I could not post the player grimoire panel in <#${playerGrimoireChannel.id}>. Setup was not saved.` }
  }

  return { ok: true, gamePanelMessage, playerGrimoirePanelMessage }
}

async function deleteOldSetupPanelMessages(client, previousConfig, nextIds = {}) {
  await deleteOldPanelMessage(client, previousConfig?.gameChannelId, previousConfig?.gamePanelMessageId, nextIds.gamePanelMessageId)
  await deleteOldPanelMessage(client, previousConfig?.playerGrimoireChannelId, previousConfig?.playerGrimoirePanelMessageId, nextIds.playerGrimoirePanelMessageId)
}

async function deleteOldPanelMessage(client, channelId, messageId, nextMessageId) {
  if (!channelId || !messageId || messageId === nextMessageId) return
  if (!client?.channels?.fetch) {
    log.recoverable('fetch-old-setup-panel-channel-unavailable', new Error('Discord client channel API unavailable'), { channelId, messageId })
    return
  }

  const channel = await client.channels.fetch(channelId).catch(err => {
    if (isStaleMessageError(err)) return null
    log.recoverable('fetch-old-setup-panel-channel', err, { channelId, messageId })
    return null
  })
  if (channel && !channel?.messages?.fetch) {
    log.recoverable('fetch-old-setup-panel-message-unavailable', new Error('Channel message API unavailable'), { channelId, messageId })
    return
  }

  const message = await channel?.messages?.fetch(messageId).catch(err => {
    if (isStaleMessageError(err)) return null
    log.recoverable('fetch-old-setup-panel-message', err, { channelId, messageId })
    return null
  })
  if (message) {
    await queuedMessageDelete(message).catch(err => {
      log.recoverable('delete-old-setup-panel-message', err, { channelId, messageId })
    })
  }
}

function createSetupPanelContext(channel, message = null) {
  return {
    channelId: channel?.id,
    guildId: channel?.guildId || channel?.guild?.id,
    messageId: message?.id
  }
}

module.exports = {
  deleteOldSetupPanelMessages,
  postSetupPanelMessages
}
