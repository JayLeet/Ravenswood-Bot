const { createVotingPanelPayload } = require('../embeds')
const {
  isClocktowerLiveMode
} = require('../../../utils/gameModes')
const {
  createPayloadSignature
} = require('../../../utils/discord/payloadSignature')
const {
  isStaleMessageError,
  queuedChannelSend,
  queuedMessageDelete,
  queuedMessageEdit
} = require('../../../utils/discord/messageActions')

const FETCH_UNAVAILABLE = Symbol('fetch-unavailable')
const WRITE_UNAVAILABLE = Symbol('write-unavailable')

async function postOrUpdateVotingPanelMessage({ deps, discordClient, guildId, knownMessage = null, nomination, options = {}, view }) {
  const { gameLifecycle, getDashboardPlayerLabels, isSetupComplete, log, messageSignatures, serverConfigs } = deps

  const serverConfig = serverConfigs.get(guildId)
  if (!isSetupComplete(serverConfig) || !nomination || !view) return null
  if (!shouldPostVotingPanel(view)) return null

  const channel = await discordClient.channels.fetch(serverConfig.liveChannelId).catch(err => {
    log?.recoverable?.('fetch-voting-panel-channel', err, {
      guildId,
      channelId: serverConfig.liveChannelId,
      nominationId: nomination.id
    })
    return null
  })
  if (!channel?.isTextBased()) return null

  const payload = createVotingPanelPayload({
    countdownText: options.countdownText,
    nomination,
    view,
    playerLabels: await getDashboardPlayerLabels(discordClient, guildId, view),
    disableVoteButtons: options.disableVoteButtons
  })
  const signature = createPayloadSignature(payload)
  let message = knownMessage?.id ? knownMessage : null

  if (!message && nomination.messageId) {
    if (!channel.messages?.fetch) {
      log?.recoverable?.('fetch-voting-panel-message-unavailable', new Error('Channel message API unavailable'), {
        channelId: channel.id,
        guildId,
        messageId: nomination.messageId,
        nominationId: nomination.id
      })
      return null
    }
    message = await channel.messages.fetch(nomination.messageId).catch(err => {
      if (isStaleMessageError(err)) return null
      log?.recoverable?.('fetch-voting-panel-message', err, {
        channelId: channel.id,
        guildId,
        messageId: nomination.messageId,
        nominationId: nomination.id
      })
      return FETCH_UNAVAILABLE
    })
    if (message === FETCH_UNAVAILABLE) return null
  }

  if (message && options.replaceMessage) {
    const deleted = await queuedMessageDelete(message, 'BOTC replace nomination panel for vote countdown').catch(err => {
      log?.recoverable?.('replace-voting-panel-delete', err, {
        guildId,
        messageId: message.id,
        nominationId: nomination.id
      })
      return WRITE_UNAVAILABLE
    })
    if (deleted === WRITE_UNAVAILABLE) return null
    deleteVotingPanelSignature(messageSignatures, guildId, message)
    message = null
  }

  if (message) {
    if (getVotingPanelSignature(messageSignatures, guildId, message) === signature) {
      rememberNominationMessage(gameLifecycle, guildId, nomination, message)
      return message
    }

    const updated = await queuedMessageEdit(message, payload).catch(err => {
      log?.recoverable?.('edit-voting-panel', err, {
        guildId,
        messageId: message.id,
        nominationId: nomination.id
      })
      return WRITE_UNAVAILABLE
    })
    if (updated === WRITE_UNAVAILABLE) return null
    if (updated) {
      setVotingPanelSignature(messageSignatures, guildId, updated, signature)
      rememberNominationMessage(gameLifecycle, guildId, nomination, updated)
      return updated
    }
  }

  message = await queuedChannelSend(channel, payload).catch(err => {
    log?.recoverable?.('send-voting-panel', err, {
      guildId,
      channelId: channel.id,
      nominationId: nomination.id
    })
    return null
  })
  if (!message) return null

  setVotingPanelSignature(messageSignatures, guildId, message, signature)
  gameLifecycle.trackMessage(guildId, message)
  rememberNominationMessage(gameLifecycle, guildId, nomination, message)
  return message
}

function getVotingPanelSignature(messageSignatures, guildId, message) {
  return messageSignatures.get(createVotingPanelSignatureKey(guildId, message))
}

function setVotingPanelSignature(messageSignatures, guildId, message, signature) {
  messageSignatures.set(createVotingPanelSignatureKey(guildId, message), signature)
}

function deleteVotingPanelSignature(messageSignatures, guildId, message) {
  messageSignatures.delete(createVotingPanelSignatureKey(guildId, message))
}

function clearVotingPanelSignaturesForGuild(messageSignatures, guildId) {
  const prefix = `${guildId}:`
  let removed = 0
  for (const key of messageSignatures.keys()) {
    if (!String(key).startsWith(prefix)) continue
    messageSignatures.delete(key)
    removed += 1
  }
  return removed
}

function createVotingPanelSignatureKey(guildId, message) {
  const messageId = typeof message === 'string' ? message : message?.id
  return `${guildId}:${messageId || 'unknown-message'}`
}

function rememberNominationMessage(gameLifecycle, guildId, nomination, message) {
  if (!message?.id || !nomination?.id) return
  if (nomination.messageId === message.id && nomination.channelId === message.channelId) return
  gameLifecycle.setNominationMessage(guildId, nomination.id, message.channelId, message.id)
}

function shouldPostVotingPanel(view) {
  return !isClocktowerLiveMode(view)
}

module.exports = {
  clearVotingPanelSignaturesForGuild,
  createVotingPanelSignatureKey,
  postOrUpdateVotingPanelMessage,
  shouldPostVotingPanel
}
