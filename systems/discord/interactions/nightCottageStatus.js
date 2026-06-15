const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js')
const {
  createSystemEmbed
} = require('./feedback')
const {
  isStaleMessageError,
  queuedChannelSend,
  queuedMessageEdit
} = require('../../../utils/discord/messageActions')
const {
  createNightInfoDismissCustomId
} = require('../../../utils/nightActionCustomIds')
const {
  runRecoverableDiscordAction
} = require('../../../utils/discord/recoverableAction')

const NIGHT_COTTAGE_STATUS_PROMPT_KEY = 'night_cottage_status'
const STATUS_REF_UNAVAILABLE = Symbol('status-ref-unavailable')
const STATUS_TITLE_EMOJIS = new Map([
  ['Done', '\u2705'],
  ['Seen by Storyteller', '\u{1F440}'],
  ['Storyteller requested', '\u{1F4E8}']
])

async function updateNightCottageStatus({
  channel,
  client = null,
  game,
  gameLifecycle = null,
  playerId,
  title,
  description,
  color
}) {
  if (!channel?.isTextBased?.() || !game || !playerId) return null

  const payload = {
    embeds: [createSystemEmbed(formatStatusTitle(title), description, color)],
    components: [createDismissStatusRow(playerId)]
  }
  const guildId = game.guildId || channel.guildId
  const existing = await fetchExistingStatus(channel, client, game.nightCottageStatusMessages?.[playerId], {
    guildId,
    playerId
  })
  if (existing === STATUS_REF_UNAVAILABLE) return null
  const message = existing
    ? await recover('edit-night-cottage-status', () => queuedMessageEdit(existing, payload), {
      guildId,
      messageId: existing.id,
      playerId
    })
    : await recover('send-night-cottage-status', () => queuedChannelSend(channel, payload), {
      channelId: channel.id,
      guildId,
      playerId
    })

  if (!message) return null

  game.nightCottageStatusMessages ??= {}
  game.nightCottageStatusMessages[playerId] = {
    channelId: message.channelId,
    messageId: message.id
  }
  gameLifecycle?.save?.()

  return message
}

function createDismissStatusRow(playerId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(createNightInfoDismissCustomId(playerId, NIGHT_COTTAGE_STATUS_PROMPT_KEY))
      .setLabel('Got it')
      .setStyle(ButtonStyle.Secondary)
  )
}

function clearNightCottageStatusRef(game, playerId, ref = null) {
  const storedRef = game?.nightCottageStatusMessages?.[playerId]
  if (!storedRef) return false
  if (ref && (storedRef.channelId !== ref.channelId || storedRef.messageId !== ref.messageId)) return false

  delete game.nightCottageStatusMessages[playerId]
  return true
}

async function fetchExistingStatus(channel, client, ref, context = {}) {
  if (!ref?.channelId || !ref?.messageId) return null
  if (ref.channelId !== channel.id && !client?.channels?.fetch) {
    await recover('fetch-night-cottage-status-channel-unavailable', () => {
      throw new Error('Discord client channel API unavailable')
    }, {
      ...context,
      channelId: ref.channelId,
      messageId: ref.messageId
    })
    return STATUS_REF_UNAVAILABLE
  }

  const targetChannel = ref.channelId === channel.id
    ? channel
    : await fetchStatusChannel(client, ref, context)
  if (targetChannel === STATUS_REF_UNAVAILABLE) return STATUS_REF_UNAVAILABLE
  if (!targetChannel?.messages?.fetch) {
    await recover('fetch-night-cottage-status-message-unavailable', () => {
      throw new Error('Channel message API unavailable')
    }, {
      ...context,
      channelId: ref.channelId,
      messageId: ref.messageId
    })
    return STATUS_REF_UNAVAILABLE
  }

  try {
    const message = await targetChannel.messages.fetch({ message: ref.messageId, cache: false, force: true })
    return message || null
  } catch (err) {
    if (isStaleMessageError(err)) return null
    await recover('fetch-night-cottage-status-message', () => {
      throw err
    }, {
      ...context,
      channelId: ref.channelId,
      messageId: ref.messageId
    })
    return STATUS_REF_UNAVAILABLE
  }
}

async function fetchStatusChannel(client, ref, context) {
  try {
    const channel = await client.channels.fetch(ref.channelId)
    return channel || null
  } catch (err) {
    if (isMissingChannelError(err)) return null
    await recover('fetch-night-cottage-status-channel', () => {
      throw err
    }, {
      ...context,
      channelId: ref.channelId,
      messageId: ref.messageId
    })
    return STATUS_REF_UNAVAILABLE
  }
}

function isMissingChannelError(err) {
  const code = err?.code ?? err?.rawError?.code
  const message = String(err?.rawError?.message || err?.message || '').toLowerCase()
  return code === 10003 || message.includes('unknown channel')
}

function formatStatusTitle(title) {
  const text = String(title || '').trim() || 'Status'
  if (STATUS_TITLE_EMOJIS.has(text)) return `${STATUS_TITLE_EMOJIS.get(text)} ${text}`
  return text
}

function recover(action, fn, context = {}) {
  return runRecoverableDiscordAction(action, fn, {
    context,
    subsystem: 'NightCottageStatus'
  })
}

module.exports = {
  NIGHT_COTTAGE_STATUS_PROMPT_KEY,
  clearNightCottageStatusRef,
  updateNightCottageStatus
}
